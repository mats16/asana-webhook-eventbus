# Asana EventBus

Please read [Asana's developers guide](https://developers.asana.com/docs/webhooks).

## How to use

### Establish a webhook

```
curl -X POST https://app.asana.com/api/1.0/webhooks \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer {access-token}' \
  -d '{"data": {"field":"value","field":"value"} }'
```

```json
{
  "data": {
    "resource": "{project_gid}",
    "target": "https://0000000000.execute-api.us-west-2.amazonaws.com/v1/{project_gid}"
  }
}
```
