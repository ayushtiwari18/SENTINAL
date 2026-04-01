from pydantic import BaseModel
from typing import Optional, Dict, Any

class AnalyzeRequest(BaseModel):
    logId: Optional[str] = None
    projectId: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    ip: Optional[str] = None
    queryParams: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, Any]] = None
