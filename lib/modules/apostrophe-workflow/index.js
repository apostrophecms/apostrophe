// This module isn't a real thing right now. It's a
// cutting floor for snippets of code related to
// workflow discovered during the 0.6 refactor. -Tom

// in renderPage

    var workflow = self.options.workflow && {
      mode: req.session.workflowMode || 'public'
    };

    // then push it as request specific data

    if (workflow && (workflow.mode === 'public')) {
      self.workflowPreventEditInPublicMode(req.extras);
    }
