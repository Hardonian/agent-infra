# Auto-generated validation utilities
# DO NOT EDIT MANUALLY - regenerate from source

from typing import Type, TypeVar, Dict, Any, Union
from pydantic import BaseModel, ValidationError

T = TypeVar('T', bound=BaseModel)

def validate(model_class: Type[T], data: Dict[str, Any]) -> T:
    """Validate and parse data into a Pydantic model.
    
    Args:
        model_class: The Pydantic model class to validate against
        data: Dictionary containing the data to validate
        
    Returns:
        Validated model instance
        
    Raises:
        ValidationError: If validation fails
    """
    return model_class.model_validate(data)

def safe_validate(model_class: Type[T], data: Dict[str, Any]) -> Dict[str, Any]:
    """Safely validate data without throwing exceptions.
    
    Args:
        model_class: The Pydantic model class to validate against
        data: Dictionary containing the data to validate
        
    Returns:
        Dict with 'success' key. If successful, includes 'data' key.
        If failed, includes 'error' key with ValidationError.
    """
    try:
        validated = validate(model_class, data)
        return {"success": True, "data": validated}
    except ValidationError as e:
        return {"success": False, "error": e}

def create_validator(model_class: Type[T]):
    """Create a reusable validator for a specific model.
    
    Returns an object with validate and safe_validate methods
    pre-configured for the given model class.
    """
    return {
        "validate": lambda data: validate(model_class, data),
        "safe_validate": lambda data: safe_validate(model_class, data),
    }
