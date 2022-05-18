# Asana EventBus

Please read [Asana's developers guide](https://developers.asana.com/docs/webhooks).

## How to use

### Deploy

#### Serverless Application Repository

[AsanaEventBus](https://serverlessrepo.aws.amazon.com/applications/us-west-2/345513370492/AsanaEventBus)

#### CloudFormation

[![launch-stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)][1]

Template: https://s3.amazonaws.com/mats-toolbox/asana-webhook-eventbus/latest/template.yaml

[1]: https://console.aws.amazon.com/cloudformation/home#/stacks/new?stackName=AsanaEventBus&templateURL=https://s3.amazonaws.com/mats-toolbox/asana-webhook-eventbus/latest/template.yaml

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
    "target": "https://0000000000.execute-api.us-west-2.amazonaws.com/v1/webhook/{project_gid}"
  }
}
```
