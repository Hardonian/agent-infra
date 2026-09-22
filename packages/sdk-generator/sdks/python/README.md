# ControlPlane SDK for Python

Auto-generated SDK from ControlPlane contracts v1.0.0.

## Installation

```bash
pip install controlplane-sdk
```

## Usage

### Pydantic Models

```python
from controlplane_sdk import JobRequest, ErrorEnvelope

# Models are fully typed Pydantic v2 models
job = JobRequest(
    id="550e8400-e29b-41d4-a716-446655440000",
    type="process-data",
    # ...
)
```

### Runtime Validation

```python
from controlplane_sdk import validate, safe_validate, JobRequest

# Runtime validation with automatic type coercion
result = validate(JobRequest, incoming_data)

# Or use safe validation to handle errors gracefully
result = safe_validate(JobRequest, incoming_data)
if result["success"]:
    print(f"Valid job: {result['data']}")
else:
    print(f"Validation failed: {result['error']}")
```

### Client Usage

```python
import os
from controlplane_sdk import ControlPlaneClient, ClientConfig

client = ControlPlaneClient(
    ClientConfig(
        base_url="https://api.controlplane.io",
        api_key=os.getenv("CONTROLPLANE_API_KEY")
    )
)

# Client includes validation methods
with client:
    validated = client.validate(JobRequest, response_data)
```

## Features

- ✅ **Pydantic v2 models** - Full type hints and validation
- ✅ **Runtime validation** - Same schemas as the server
- ✅ **Zero drift** - Auto-generated from canonical contracts
- ✅ **IDE support** - Full IntelliSense in VS Code, PyCharm, etc.

## Versioning

This SDK follows semantic versioning and tracks the ControlPlane contract version:
- SDK version: 1.0.0
- Contract version: 1.0.0

## Regeneration

This SDK is auto-generated. Do not edit manually.
To regenerate, run: `sdk-gen --language python`

## License

Apache-2.0
