#!/bin/sh

VERSION=`cat package.json | grep \"version\": | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+'`
perl -pi -e "s/apos.version = \"[0-9\.]+\"/apos.version = \"$VERSION\"/" public/js/content.js &&
git add -A public/js/content.js &&
git commit -m "bump version number in client side javascript" &&
git push
