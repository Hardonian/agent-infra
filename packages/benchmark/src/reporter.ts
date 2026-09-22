import type { BenchmarkReport, BenchmarkResult } from './contracts/index.js';
import Table from 'cli-table3';
import chalk from 'chalk';

export class BenchmarkReporter {
  private format: 'json' | 'table' | 'markdown';

  constructor(format: 'json' | 'table' | 'markdown' = 'table') {
    this.format = format;
  }

  report(report: BenchmarkReport): string {
    switch (this.format) {
      case 'json':
        return this.renderJson(report);
      case 'table':
        return this.renderTable(report);
      case 'markdown':
        return this.renderMarkdown(report);
      default:
        return this.renderTable(report);
    }
  }

  private renderJson(report: BenchmarkReport): string {
    return JSON.stringify(report, null, 2);
  }

  private renderTable(report: BenchmarkReport): string {
    let output = '\n';

    output += chalk.bold.blue('═══════════════════════════════════════════════════════════════\n');
    output += chalk.bold.blue(`  📊 Benchmark Report: ${report.suite.name}\n`);
    output += chalk.bold.blue('═══════════════════════════════════════════════════════════════\n');
    output += chalk.gray(`  ${report.suite.description}\n\n`);

    output += chalk.bold('Environment:\n');
    output += `  Node.js: ${report.environment.nodeVersion}\n`;
    output += `  Platform: ${report.environment.platform} (${report.environment.arch})\n`;
    output += `  CPUs: ${report.environment.cpus}, Memory: ${report.environment.totalMemoryMb}MB\n\n`;

    output += chalk.bold('Summary:\n');
    const summaryTable = new Table({
      head: ['Total', 'Passed', 'Failed', 'Skipped', 'Duration'],
      colWidths: [10, 10, 10, 10, 15],
    });
    summaryTable.push([
      report.summary.total,
      chalk.green(report.summary.passed),
      chalk.red(report.summary.failed),
      chalk.yellow(report.summary.skipped),
      `${(report.summary.totalDurationMs / 1000).toFixed(2)}s`,
    ]);
    output += summaryTable.toString() + '\n\n';

    for (const result of report.results) {
      output += this.renderResultTable(result);
      output += '\n';
    }

    return output;
  }

  private renderResultTable(result: BenchmarkResult): string {
    let output = '';

    const statusColor =
      result.status === 'passed'
        ? chalk.green
        : result.status === 'failed'
          ? chalk.red
          : chalk.yellow;

    output += statusColor(`● ${result.name} [${result.suite}] `);
    output += chalk.gray(`(${result.durationMs}ms) - `);
    output += statusColor(result.status.toUpperCase()) + '\n';

    if (result.description) {
      output += chalk.gray(`  ${result.description}\n`);
    }

    if (result.error) {
      output += chalk.red(`  Error: ${result.error}\n`);
    }

    if (result.metrics.length > 0) {
      const metricsTable = new Table({
        head: ['Metric', 'Value', 'Unit', 'Description'],
        colWidths: [30, 15, 10, 50],
        style: { head: ['cyan'] },
      });

      for (const metric of result.metrics) {
        metricsTable.push([
          metric.name,
          metric.value.toString(),
          metric.unit,
          metric.description.length > 47
            ? metric.description.substring(0, 47) + '...'
            : metric.description,
        ]);
      }

      output += metricsTable.toString() + '\n';
    }

    return output;
  }

  private renderMarkdown(report: BenchmarkReport): string {
    let output = `# Benchmark Report: ${report.suite.name}\n\n`;

    output += `**Description:** ${report.suite.description}\n\n`;
    output += `**Timestamp:** ${report.timestamp}\n\n`;

    output += '## Environment\n\n';
    output += `- **Node.js:** ${report.environment.nodeVersion}\n`;
    output += `- **Platform:** ${report.environment.platform} (${report.environment.arch})\n`;
    output += `- **CPUs:** ${report.environment.cpus}\n`;
    output += `- **Memory:** ${report.environment.totalMemoryMb}MB\n\n`;

    output += '## Summary\n\n';
    output += '| Total | Passed | Failed | Skipped | Duration |\n';
    output += '|-------|--------|--------|---------|----------|\n';
    output += `| ${report.summary.total} | ${report.summary.passed} | ${report.summary.failed} | ${report.summary.skipped} | ${(report.summary.totalDurationMs / 1000).toFixed(2)}s |\n\n`;

    output += '## Results\n\n';

    for (const result of report.results) {
      output += `### ${result.name} [${result.suite}]\n\n`;
      output += `- **Status:** ${result.status}\n`;
      output += `- **Duration:** ${result.durationMs}ms\n`;

      if (result.description) {
        output += `- **Description:** ${result.description}\n`;
      }

      if (result.error) {
        output += `- **Error:** ${result.error}\n`;
      }

      output += '\n';

      if (result.metrics.length > 0) {
        output += '| Metric | Value | Unit | Description |\n';
        output += '|--------|-------|------|-------------|\n';

        for (const metric of result.metrics) {
          output += `| ${metric.name} | ${metric.value} | ${metric.unit} | ${metric.description} |\n`;
        }

        output += '\n';
      }
    }

    return output;
  }
}
