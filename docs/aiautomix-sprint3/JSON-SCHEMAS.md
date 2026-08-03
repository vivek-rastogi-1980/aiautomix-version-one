# JSON Schemas

## Business Validator Response

``` json
{
  "overallScore":0,
  "summary":"",
  "marketOpportunity":"",
  "customerPersona":"",
  "swot":{"strengths":[],"weaknesses":[],"opportunities":[],"threats":[]},
  "revenueModels":[],
  "risks":[],
  "recommendations":[],
  "nextSteps":[]
}
```

## Error Response

``` json
{"success":false,"error":{"code":"AI_VALIDATION_FAILED","message":"Human readable message"}}
```

## Report Metadata

``` json
{"workflow":"business-validator","promptVersion":"v1","model":"gpt","durationMs":0,"tokens":0}
```
