# @apostrophecms/stylelint-no-mixed-decls 

A Stylelint plugin that enforces Sass's `mixed-decls` rule — requiring declarations and nested rules to be ordered according to Sass's updated behavior.

> ⚠️ Since Sass `1.77.0+`, CSS blocks can no longer freely mix declarations and nested rules.  
> If you want to declare additional styles after nested rules, those declarations must be placed inside a `& { }` block.
>
> See: https://sass-lang.com/documentation/breaking-changes/mixed-decls/

## What this plugin does

- Prevents declarations appearing after nested rules within a CSS block unless they're wrapped in a `& { }` block.
- Handle `@include` statements that may contain nested rules.

## Installation

```bash
npm install @apostrophecms/stylelint-no-mixed-decls --save-dev
```

## Usage

Add it to your Stylelint configuration:

```js
{
  "plugins": [ "@apostrophecms/stylelint-no-mixed-decls" ],
  "rules": {
    "@apostrophecms/stylelint-no-mixed-decls": true
  }
}
```

You can set a `contain-nested` option to list mixins that are known to contain nested rules.  
This is an answer to the [limitations](#limitations) that this plugin cannot analyze mixin definitions from other files.

```js
{
  "plugins": [ "@apostrophecms/stylelint-no-mixed-decls" ],
  "rules": {
    "@apostrophecms/stylelint-no-mixed-decls": [
      true,
      {
        "contain-nested": [ "external-mixin-known-to-contain-nested-rules" ]
      }
    ] 
  }
}
```

## Example: Correct Usage

```scss
.foo {
  color: red;

  &--large {
    font-size: 24px;
  }

  & {
    font-weight: bold;
  }
}
```

```scss
@mixin foo {
  display: block;
  clear: both;
}

.foo {
  @include foo;
  @include external-mixin; // not known to contain nested rules
  color: red;
}
```

```scss
@mixin foo {
  display: block;
  clear: both;

  &--large {
    font-size: 24px;
  }
}

.foo {
  @include foo;

  & {
    color: red;
  }
}
```

```scss
@mixin foo {
  & {
    display: block;
    clear: both;
  }
}

.foo {
  font-weight: bold;

  & {
    color: red;
  }

  @include foo;
}
```

## Example: Incorrect Usage (will report)

```scss
.foo {
  color: red;

  &--large {
    font-size: 24px;
  }

  font-weight: bold; // ❌ Cannot mix declarations and nested rules. Group them together or wrap declarations in a nested "& { }" block. See https://sass-lang.com/documentation/breaking-changes/mixed-decls/
}
```

```scss
@mixin foo {
  display: block;
  clear: both;

  &--large {
    font-size: 24px;
  }
}

.foo {
  @include foo;
  color: red; // ❌ Cannot mix declarations and nested rules. Group them together or wrap declarations in a nested "& { }" block. See https://sass-lang.com/documentation/breaking-changes/mixed-decls/
}
```

```scss
@mixin foo {
  display: block; // ❌ Cannot mix declarations and nested rules. Group them together or wrap declarations in a nested "& { }" block. See https://sass-lang.com/documentation/breaking-changes/mixed-decls/
  clear: both; // ❌ Cannot mix declarations and nested rules. Group them together or wrap declarations in a nested "& { }" block. See https://sass-lang.com/documentation/breaking-changes/mixed-decls/
}

.foo {
  font-weight: bold;

  & {
    color: red;   
  }

  @include foo;
}
```

```scss
.foo {
  @include external-mixin-known-to-contain-nested-rules;

  color: red; // ❌ Cannot mix declarations and nested rules. Group them together or wrap declarations in a nested "& { }" block. See https://sass-lang.com/documentation/breaking-changes/mixed-decls/
}
```

## Why this matters

This plugin ensures your Sass code adheres to modern CSS nesting behavior,
prevents breaking builds on newer Sass versions,
and keeps your codebase cleanly structured.

## Limitations

This plugin only analyzes mixins defined within the same file being linted.
It does not resolve or inspect mixin definitions from other files,
even if those files are imported via Sass `@use` or `@import`.

As a result:

- If a mixin with the same name exists in multiple files with different contents
(some containing nested rules, others not), this plugin will only be aware of
the mixin definitions present in the file currently being linted.

- It will not detect nested rules within mixins defined elsewhere or included
from external files.

**Recommendation:**

To ensure accurate linting results, define critical mixins with nested rules consistently
or colocate them with the code that uses them.
Alternatively, wrap declarations following `@include` statements
in a nested `& { }` block as a safe default when unsure of the mixin's contents.

**Use `contain-nested` option:**

This option can be used to list mixins that are known to contain nested rules,
so that the plugin can treat them accordingly,
even if their definition is not present in the file they are used.

## Please contribute!

We welcome contributions! If you find a bug or something missing,
please open an issue or submit a pull request.
