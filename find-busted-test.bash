#!/bin/bash

# This is a script to run our mocha tests one by one, rather than automatically
# via mocha, so we can figure out which one is hanging if we have unreleased
# timeouts, etc. at the end of a test script. Not needed often. -Tom

files=test/*.js
echo $files
for file in $files; do
  echo $file
  ./node_modules/.bin/mocha $file
done

