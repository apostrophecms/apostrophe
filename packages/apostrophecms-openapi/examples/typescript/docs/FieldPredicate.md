# FieldPredicate

A simple equality (primitive) or an OperatorObject. :contentReference[oaicite:5]{index=5}

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**$eq** | **any** |  | [optional] [default to undefined]
**$ne** | **any** |  | [optional] [default to undefined]
**$gt** | **number** |  | [optional] [default to undefined]
**$gte** | **number** |  | [optional] [default to undefined]
**$lt** | **number** |  | [optional] [default to undefined]
**$lte** | **number** |  | [optional] [default to undefined]
**$in** | **Array&lt;any&gt;** |  | [optional] [default to undefined]
**$nin** | **Array&lt;any&gt;** |  | [optional] [default to undefined]
**$exists** | **boolean** |  | [optional] [default to undefined]

## Example

```typescript
import { FieldPredicate } from 'apostrophecms-client';

const instance: FieldPredicate = {
    $eq,
    $ne,
    $gt,
    $gte,
    $lt,
    $lte,
    $in,
    $nin,
    $exists,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
