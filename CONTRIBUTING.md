# ApostropheCMS Contribution Guide

Interested in contributing to ApostropheCMS? That’s fantastic! We really
appreciate your interest and value your time. Because of that fact, we’ve
drafted some guidelines to make the most of your contributions. Your
contributions help maintain ApostropheCMS as the best Node CMS in the universe.

In addition to contributing code, you can also join the growing community on
[Discord](https://chat.apostrophecms.org/) for discussion, core development
updates, and help as you build with Apostrophe.

## Code of Conduct

All contributors and community members are expected to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md). In short, be excellent to one another,
respect everyone's contribution, and never harrass anyone for any reason. Alert
the core team at [help@apostrophecms.com](mailto:help@apostrophecms.com) if you
find someone failing to abide by the Code of Conduct.

## Contributions Made Easy

One way to contribute to ApostropheCMS is by expanding the existing
documentation. The [documentation repo](https://github.com/apostrophecms/apostrophe-documentation)
is public and we appreciate contributions. Pull requests that update and refine
this information are super useful.

Along those lines, the authoring of blog posts about your experiences using
ApostropheCMS or tweets expressing your interest help spread the word. When you
launch a site on ApostropheCMS, ping us in [Discord](https://chat.apostrophecms.com)
or on [Twitter](https://twitter.com/apostrpohecms). We love a good success story.

Of course, we welcome traditional open source contributions via pull requests
and new open issues to our GitHub repository. If you’d like to dig in right away
see issues with the ["help wanted"](https://github.com/apostrophecms/apostrophe/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22)
and ["good first issue"](https://github.com/apostrophecms/apostrophe/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) labels.

## Reporting a Bug

If you come across a bug, please submit an issue in the GitHub repo. That’s the
primary source for bug documentation, so first be sure to search the existing
issues and make sure it hasn’t been logged. If it hasn’t, please include the
following details as they apply:

1. Steps to reproduce the bug.
2. The expected behavior and actual behavior.
3. Screenshots or animated .GIFs to help illustrate the behavior.
4. Code samples.

Finally, remember to attach the `bug` label to the issue, to help use stay
organized.

Bonus: Although not required, if you write a test that reproduces the bug you
found, and submit that failing test as a PR… well, we might even send you some
swag 😉.

If you're not sure that it's a bug or a problem in your code, you can post and
find answers to support questions about ApostropheCMS in
[StackOverflow](https://stackoverflow.com/questions/tagged/apostrophe-cms) or
[Discord](https://chat.apostrophecms.org).

## Suggesting a Feature or Enhancement

We also track feature requests and larger scale enhancements within the GitHub
repository. After a search of existing issues to confirm your idea is unique,
please feel free to submit your idea as a new issue. Remember to include details
that articulate the current functionality and how this enhancement will improve
or build upon that. Attaching images to illustrate your feature is often useful.

Adding the label of `enhancement` along with categorizing your issue with an
existing label such as `UI`, `UX`, `accessibility`, `security`, etc. will help
the core maintainers stay organized and is greatly appreciated.

## Fixing Bugs or Submitting Enhancements

If you’ve perused our open issues labeled `bug` and decide to work to resolve
one, or you’ve got a new feature that you’d like to commit to the core project,
please keep these things in mind:

1. Make sure your pull request includes tests. [For examples of back-end unit
tests, look here](https://github.com/apostrophecms/apostrophe/tree/master/test)
at the test folder of the apostrophe module. This level of coverage is expected
for backend features that aren't already covered by a test. For examples of
front-end, browser-based regression tests, [check out the
`apostrophe-enterprise-testbed` module](https://github.com/apostrophecms/apostrophe-enterprise-testbed).
We don't expect that every contributor is ready to write Nightwatch tests like
these, but it is surely appreciated. If it’s a bug fix you should have a test
that reproduces the issue (if you can’t write a test for the bug you are
addressing, please note the reason why).
2. Run ESLint to be sure your update adheres to our coding standards. The
`apostrophe` module already has a `.eslintrc` file, so the simplest way is to
run: `npx eslint .` Your editor may automatically point out eslint-detected
concerns as well.
3. Enhancements should include documentation and include implementation details
were applicable.

## Should you make a new npm module?

Great question. If it's not a bug fix or an improvement to the core UI, it often
doesn't belong in the core `apostrophe` npm module. For instance, our blogging
functionality is in the separate `apostrophe-blog` npm module.

See [publishing your own npm modules for Apostrophe](https://docs.apostrophecms.org/apostrophe/other/more-modules#publishing-your-own-npm-modules-for-apostrophe) for more information.
