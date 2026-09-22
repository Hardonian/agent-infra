# ControlPlane SDK for Go

Auto-generated SDK from ControlPlane contracts v1.0.0.

## Installation

```bash
go get github.com/controlplane/sdk-go
```

## Usage

### Struct Types

```go
package main

import (
    "github.com/controlplane/sdk-go"
)

func main() {
    // Models are fully typed Go structs
    job := controlplane.JobRequest{
        ID:   "550e8400-e29b-41d4-a716-446655440000",
        Type: "process-data",
        // ...
    }
}
```

### Runtime Validation

```go
package main

import (
    "fmt"
    "github.com/controlplane/sdk-go"
)

func main() {
    job := controlplane.JobRequest{
        ID:   "550e8400-e29b-41d4-a716-446655440000",
        Type: "process-data",
    }

    // Each model has a Validate() method
    if err := job.Validate(); err != nil {
        fmt.Printf("Validation failed: %v\n", err)
    }
}
```

### Client Usage

```go
package main

import (
    "context"
    "os"

    "github.com/controlplane/sdk-go"
)

func main() {
    client := controlplane.NewClient(controlplane.ClientConfig{
        BaseURL: "https://api.controlplane.io",
        APIKey:  os.Getenv("CONTROLPLANE_API_KEY"),
    })

    ctx := context.Background()
    resp, err := client.Request(ctx, "GET", "/health", nil)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
}
```

## Features

- ✅ **Strongly typed structs** - Full compile-time type safety
- ✅ **Built-in validation** - Each model has a Validate() method
- ✅ **Zero drift** - Auto-generated from canonical contracts
- ✅ **Context support** - Full context.Context support for timeouts

## Versioning

- SDK version: 1.0.0
- Contract version: 1.0.0

## Regeneration

This SDK is auto-generated. Do not edit manually.
To regenerate, run: `sdk-gen --language go`

## License

Apache-2.0
