// Auto-generated validation utilities
// DO NOT EDIT MANUALLY - regenerate from source

package controlplane

import (
	"errors"
	"fmt"
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidationErrors collects multiple validation errors
type ValidationErrors struct {
	Errors []ValidationError
}

func (e ValidationErrors) Error() string {
	if len(e.Errors) == 0 {
		return "validation failed"
	}
	return e.Errors[0].Error()
}

// IsValid checks if there are no validation errors
func (e ValidationErrors) IsValid() bool {
	return len(e.Errors) == 0
}

// Add adds a validation error
func (e *ValidationErrors) Add(field, message string) {
	e.Errors = append(e.Errors, ValidationError{Field: field, Message: message})
}
