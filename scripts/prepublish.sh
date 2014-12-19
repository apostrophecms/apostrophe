#!/bin/sh

VERSION=`cat package.json | grep \"version\": | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+'`
perl -pi -e "s/apos.version = \"[0-9\.]+\"/apos.version = \"$VERSION\"/" public/js/content.js

