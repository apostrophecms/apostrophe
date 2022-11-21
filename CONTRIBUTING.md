# ApostropheCMS Contribution Guide

Interested in contributing to ApostropheCMS? Excellent! 🙌

We really appreciate your interest and value your time. The guidelines below are
meant to make the most of your time and work. Your contributions help maintain
ApostropheCMS as (in our opinion) the best Node CMS in the universe.

In addition to contributing to the project, you can also join the growing
community on [Discord](https://chat.apostrophecms.org/) for discussion, core
development updates, and help as you build with Apostrophe. There are also
[Github Discussions](https://github.com/apostrophecms/apostrophe/discussions) and
[Stack Overflow](https://stackoverflow.com/questions/tagged/apostrophe-cms).

- [ApostropheCMS Contribution Guide](#apostrophecms-contribution-guide)
  - [Code of Conduct](#code-of-conduct)
  - [How can I contribute?](#how-can-i-contribute)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting a Feature or Enhancement](#suggesting-a-feature-or-enhancement)
    - [Fixing Bugs or Submitting Enhancements](#fixing-bugs-or-submitting-enhancements)
    - [Contributing to Apostrophe Core](#contributing-to-apostrophe-core)
      - [**What to expect next**](#what-to-expect-next)
    - [Improving documentation](#improving-documentation)
    - [Share the Love](#share-the-love)
  - [Should I make a new npm module?](#should-i-make-a-new-npm-module)

## Code of Conduct

All contributors and community members are expected to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md). In short, be excellent to one another,
respect everyone's contribution, and never harass anyone for any reason. Alert
the core team at [conduct@apostrophecms.com](mailto:conduct@apostrophecms.com) if you
find someone failing to abide by the Code of Conduct.

## How can I contribute?

### Reporting Bugs

If you come across a bug, please submit an issue in the GitHub repo. Be sure to
search the existing issues first and make sure it hasn’t already been logged.
If it has, add a comment with any information you think might help resolve it.

If it hasn’t, check:

- Are you on the lastest minor version of the Apostrophe modules you're using?
- Is your dev environment up to date? Primarily this means a LTS version of
Node.js and MongoDB 3.x or 4.x.
- Is this related to project code? Can you reproduce it in a minimal test case,
without the rest of your project code? If it might be specific to your project,
asking a question is a better first step (see below).

If the answer to those is "yes," please submit a bug issue. There is a bug issue
template when you create one in Github to help with that.

Bonus: Although not required, if you write a test that reproduces the bug you
found, and submit that failing test as a PR… well, we might even send you some
swag 😉.

If you're not sure whether it's a bug or a problem in your code, you can post questions and
find answers to support questions about ApostropheCMS in
[StackOverflow](https://stackoverflow.com/questions/tagged/apostrophe-cms) or
[Discord](https://chat.apostrophecms.org).

### Suggesting a Feature or Enhancement

We track feature requests and larger scale enhancements within the GitHub
repository. After you search existing issues to confirm your idea is new,
please submit your idea as a new issue. Remember to include details
that articulate the current functionality and how this enhancement will improve
or build upon that. Again, there's an issue template to help you.

### Fixing Bugs or Submitting Enhancements

PRs to resolve existing issues are fantastic. Two good places to start are the
["help wanted"](https://github.com/apostrophecms/apostrophe/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22)
and ["good first issue"](https://github.com/apostrophecms/apostrophe/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) issues.

Please note that if you are using Windows for development, we strongly recommend
using
[Windows Subsystem for Linux (WSL)](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/windows-or-wsl)
both for development on the core Apostrophe modules and developing your own
applications.

If you’ve perused our open issues labeled `bug` and decide to work to resolve
one, or you’ve got a new feature that you’d like to commit to the core project,
please keep these things in mind:

1. **Most substantial changes will require tests.** [For examples of back-end unit
tests, look here](https://github.com/apostrophecms/apostrophe/tree/main/test)
at the test folder of the `apostrophe` module. This level of coverage is expected
for backend features that aren't already covered by a test. If you are submit
bug fix, please do include a test that reproduces the issue.
1. **Make sure existing tests pass.** Run `npm test` to run the tests, including
the code linters.
3. **Enhancements should include documentation** and include implementation details
were applicable. For Apostrophe core, that should be in the
[main documentation](https://github.com/apostrophecms/a3-docs)
and for other modules, add it in their README files (unless the README directs
you elsewhere).

### Contributing to Apostrophe Core

This is assuming you are interacting with the ApostropheCMS repositories on the GitHub website. If you are using GitHub Desktop you can read about how to fork a repository in the [GitHub docs.](https://docs.github.com/en/desktop/contributing-and-collaborating-using-github-desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop)

1. Fork the main Apostrophe repository to your own account by clicking on the fork button at the top of the [GitHub page.](https://github.com/apostrophecms/apostrophe) If you are contributing to the latest version of Apostrophe you can simply click on the "Create fork" button on the next screen. If you are contributing to Apostrophe 2, you will need to uncheck the "Copy the main branch only" selection before creating the fork.
2. The forked version of the repository can be modified in any way you would like without impact on the original repository. As a best practice, we request that you create a branch with a short informative name for making code changes. This makes it easier for our team to track what you are contributing when you make your pull request (PR).
3. Once you've completed your code changes (and updates to `CHANGELOG.md` if needed - see the notes above) you can push all of your changes to your repo. Navigating to your GitHub repository page you will see a banner for creating a PR. Click on the "Contribute" and then "Open a pull request" buttons.
4. This will bring up a PR page. There are a number of sections to be filled out. Please read carefully and make selections where needed. Following this checklist is very helpful when our team reviews your request. If you need help, just ask!
5. Finally, it is best to notify a team member on the [Discord channel](https://discord.com/channels/517772094482677790/701815369005924374) that you have submitted a PR. You can also find our contact addresses on our GitHub pages. We don't get automatic notifications from community-submitted PRs. We will see it in the queue eventually, notifying us will just speed up the process.
   
#### **What to expect next**

After we get your PR, we will assign someone from the team to review it. They will follow your testing recommendations and run any tests that you have included. They will also look to make sure your code passes all of our internal linting tests. If there are any issues, the reviewer will highlight the needed changes in their PR review. You can then respond to those suggestions with another round of code changes and submissions to your code branch. Once accepted, the reviewer will merge your changes into the proper repository branch. You can then give yourself a well deserved pat on the back - thanks! 🥳

### Improving documentation

The [documentation repo](https://github.com/apostrophecms/a3-docs)
is public and we appreciate contributions. The core maintainers know Apostrophe
very well, but that can make it hard to see where the gaps in documentation are.
Please open issues there letting us know (nicely, please). Even better, submit a
pull request documenting something and you'll be helping many developers going
forward. The mechanism for creating a pull request for documentation is the same as the method described for contributing to the core. To summarize:
1. Fork
2. Clone and create branch
3. Make changes and push to branch
4. Make pull request (PR) and notify Apostrophe development team
5. Respond to PR comments with any needed changes
6. Enjoy your awesome contribution - thanks! 🎉

Even typo fixes are great!

### Share the Love

Authoring blog posts, giving talks at a meet-up, or otherwise sharing
experiences using ApostropheCMS help spread the word. When you launch a site on
ApostropheCMS, ping us in [Discord](https://chat.apostrophecms.org) or on
[Twitter](https://twitter.com/apostrophecms). We love a good success story.

## Should I make a new npm module?

Great question. If it's not a bug fix or an improvement to the core UI, it often
doesn't belong in the core `apostrophe` npm module. For instance, our SEO
functionality is in the separate `@apostrophecms/seo` npm module.

**Some tips:**

- You can take any Apostrophe project module (`modules/my-module`), move
that to the root of its own repository and package it up as an npm module. It
should just work, as long as all of your dependencies are part of the module.
Set `peerDependencies` if this will rely on a module that isn't directly used in
your code.
- **Please do not use the** `apostrophe-` **prefix for your module, or the**
`apos-` **prefix for your styles** without consulting the core team. This was an
Apostrophe 2 convention, but by reserving these for the official Apostrophe
modules, we can maintain clarity for new Apostrophe developers regarding
which modules the core team is committed to maintaining.
  - To avoid confusion, you can pick your own prefix. It's good practice to use
  a prefix so that you don't conflict with project-level modules.
- Add `apostrophecms` to your keywords in `package.json` to help people find
your module.
