# UiCondition

\'Apostrophe conditional used by `if` and `requiredIf`. Keys are field paths (including `<` parent access and dot notation) or method calls with `()`. Values are either simple equality (primitive) or an operator object. Supports `$or` / `$and` groups. See OperatorObject. 

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**$or** | [**Array&lt;UiCondition&gt;**](UiCondition.md) | Any condition group may pass. :contentReference[oaicite:1]{index&#x3D;1} | [optional] [default to undefined]
**$and** | [**Array&lt;UiCondition&gt;**](UiCondition.md) | All condition groups must pass. (Redundant at the same level, but useful when nested with &#x60;$or&#x60;.) :contentReference[oaicite:2]{index&#x3D;2} | [optional] [default to undefined]

## Example

```typescript
import { UiCondition } from 'apostrophecms-client';

const instance: UiCondition = {
    $or,
    $and,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
