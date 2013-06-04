#!/bin/sh

# Update the jQuery plugins we maintain ourselves to their latest
# versions in github. This isn't something you should ever have to
# run yourself, we use it periodically when we update our plugins.
# We use it only when the plugins' latest published releases are
# reflected in the master branch.

plugins=(find-by-name, selective, get-outer-html, bottomless, radio, images-ready, projector)
for plugin in "${plugins[@]}"
do
  wget "https://raw.github.com/punkave/jquery-${plugin}/master/jquery.${plugin}.js" -o public/js/jquery.${plugin}.js
done
