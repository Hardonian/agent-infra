# Auto-generated ControlPlane SDK Client
# DO NOT EDIT MANUALLY - regenerate from source

from dataclasses import dataclass
from typing import Optional, Dict, Any, Type, TypeVar, Generic
import httpx
from pydantic import BaseModel, ValidationError

from .models import ContractVersion

T = TypeVar('T', bound=BaseModel)

@dataclass
class ClientConfig:
    base_url: str
    api_key: Optional[str] = None
    timeout: float = 30.0

class ControlPlaneClient:
    def __init__(self, config: ClientConfig):
        self.config = config
        self.contract_version = ContractVersion(
            major=1,
            minor=0,
            patch=0
        )
        self._client = httpx.Client(
            base_url=config.base_url,
            timeout=config.timeout,
            headers=self._default_headers()
        )

    def _default_headers(self) -> Dict[str, str]:
        headers = {
            'Content-Type': 'application/json',
            'X-Contract-Version': self._serialize_version(self.contract_version),
        }
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'
        return headers

    def _serialize_version(self, version: ContractVersion) -> str:
        return f'{version.major}.{version.minor}.{version.patch}'

    def get_contract_version(self) -> ContractVersion:
        return self.contract_version

    def validate(self, model_class: Type[T], data: Dict[str, Any]) -> T:
        """Validate data against a Pydantic model."""
        return model_class.model_validate(data)

    def safe_validate(self, model_class: Type[T], data: Dict[str, Any]) -> Dict[str, Any]:
        """Safely validate data, returning result with success flag."""
        try:
            validated = self.validate(model_class, data)
            return {"success": True, "data": validated}
        except ValidationError as e:
            return {"success": False, "error": e}

    def request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        response = self._client.request(method, path, **kwargs)
        response.raise_for_status()
        return response.json()

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
