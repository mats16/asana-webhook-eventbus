export interface AsanaEvent {
  user?: {
    gid: string;
    resource_type: string;
  };
  created_at: string;
  action: 'changed'|'added'|'removed'|'deleted'|'undeleted';
  resource: {
    gid: string;
    resource_type: string;
    resource_subtype?: string;
  };
  parent?: {
    gid: string;
    resource_type: string;
    resource_subtype?: string;
  };
  change?: {
    field: string;
    action: string;
    new_value?: {
      gid: string;
      resource_type: string;
      resource_subtype?: string;
      enum_value?: {
        gid: string;
        resource_type: string;
      };
    };
  };
}

export interface AsanaPayload {
  events: AsanaEvent[];
}