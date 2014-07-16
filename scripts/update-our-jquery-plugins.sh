#!/bin/sh

# RUN FROM THE MODULE'S MAIN FOLDER.
#
# Update the jQuery plugins we maintain ourselves to their latest
# versions in github. This isn't something you should ever have to
# run yourself, we use it periodically when we update our plugins.
# We use it only when the plugins' latest published releases are
# reflected in the master branch.

plugins=(find-by-name selective get-outer-html bottomless radio images-ready projector json-call)
for plugin in "${plugins[@]}"
do
  wget --no-check-certificate "https://raw.github.com/punkave/jquery-${plugin}/master/jquery.${plugin}.js" -O public/js/vendor/jquery.${plugin}.js
done

wget --no-check-certificate "https://raw.github.com/jsumnersmith/lister/master/src/jquery.lister.js" -O public/js/vendor/jquery.lister.js
