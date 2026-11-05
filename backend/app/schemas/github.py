from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GitHubAction = Literal[
    "read_repository", "read_issues", "create_issues", "comment", "create_branch", "open_pull_request"
]


class GitHubInstallCallback(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: str = Field(min_length=43, max_length=128)
    installation_id: int = Field(gt=0, le=2**53 - 1)


class GitHubOAuthCallback(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: str = Field(min_length=43, max_length=128)
    code: str = Field(min_length=1, max_length=512)


class GitHubMappingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    connected: bool


class GitHubAccessUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    level: Literal["none", "read", "write"]
    denied_actions: list[GitHubAction] = Field(default_factory=list, max_length=6)
