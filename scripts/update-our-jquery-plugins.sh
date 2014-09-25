#!/bin/sh

# RUN FROM THE MODULE'S MAIN FOLDER.
#
# Update the jQuery plugins we maintain ourselves to their latest
# versions in github. This isn't something you should ever have to
# run yourself, we use it periodically when we update our plugins.
# We use it only when the plugins' latest published releases are
# reflected in the master branch.

plugins=(find-by-name selective get-outer-html bottomless radio images-ready projector json-call find-safe)
for plugin in "${plugins[@]}"
do
  echo "https://raw.github.com/punkave/jquery-${plugin}/master/jquery.${plugin}.js"
  wget --no-check-certificate "https://raw.github.com/punkave/jquery-${plugin}/master/jquery.${plugin}.js" -O public/js/vendor/jquery.${plugin}.js
done

wget --no-check-certificate "https://raw.github.com/jsumnersmith/lister/master/src/jquery.lister.js" -O public/js/vendor/jquery.lister.js

# Doesn't follow our naming pattern
wget --no-check-certificate "https://raw.github.com/punkave/jquery-find-safe/master/jquery.findSafe.js" -O public/js/vendor/jquery.findSafe.js
