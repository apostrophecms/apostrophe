---
"apostrophe": minor
---

apostrophe and oembetter have been updated to eliminate a number of services that formerly supported
oembed for the general public, but no longer do so. While there is no security risk today, removing
these ensures that if these domains are ever allowed to lapse, they do not become an XSS
attack vector in the future.

Because oembed responses are not always iframes, it is important that this list be maintained
over time. In addition, developers always have the option to prune it on their own by setting
the new minimumAllowlist and minimumEndpoints options of the @apostrophecms/oembed module.

Thanks to [Sainithin0309](https://github.com/Sainithin0309) for pointing out the potential
long-term security concern.
