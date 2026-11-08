#!/usr/bin/env python3
"""Regression tests for runtime discovery, not a GPU compute verification."""
import json
import os
from pathlib import Path
# This test invokes only the adjacent local doctor script.
import subprocess  # nosec B404
import tempfile
import unittest

DOCTOR = Path(__file__).with_name('hx370-doctor.sh')


class GpuDiscoveryTest(unittest.TestCase):
    def run_doctor(self, home, path):
        env = dict(os.environ, HOME=str(home), PATH=path,
                   HX370_REMOTE_PROBE_HOST='127.0.0.1', HX370_PROBE_TIMEOUT='1')
        # Fixed adjacent script and arguments, no shell; HOME/PATH are test fixtures.
        result = subprocess.run([str(DOCTOR), '--json'], env=env, text=True,  # nosec B603
                                capture_output=True, timeout=30, check=True)
        return json.loads(result.stdout)['acceleration']

    def test_user_venv_rocm_discovery_is_unverified(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            tool = home / '.local/share/rocm-wsl-venv/lib/python3.12/site-packages/_rocm_sdk_core/bin/rocminfo'
            tool.parent.mkdir(parents=True)
            tool.write_text('#!/bin/sh\nexit 1\n')
            tool.chmod(0o755)
            acceleration = self.run_doctor(home, os.environ['PATH'])
            self.assertEqual(acceleration['gpu_compute_api'], 'rocm-present-unverified')
            self.assertIs(acceleration['gpu_compute_verified'], False)

    def test_absent_runtime_is_none(self):
        with tempfile.TemporaryDirectory() as temp:
            acceleration = self.run_doctor(Path(temp), os.environ['PATH'])
            self.assertEqual(acceleration['gpu_compute_api'], 'none')
            self.assertIs(acceleration['gpu_compute_verified'], False)

    def test_path_runtime_is_unverified(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            tool = home / 'rocminfo'
            tool.write_text('#!/bin/sh\nexit 1\n')
            tool.chmod(0o755)
            acceleration = self.run_doctor(home, f"{home}:{os.environ['PATH']}")
            self.assertEqual(acceleration['gpu_compute_api'], 'rocm-present-unverified')
            self.assertIs(acceleration['gpu_compute_verified'], False)


if __name__ == '__main__':
    unittest.main()
