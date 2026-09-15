const observer = ({
  callback,
  root,
  rootMargin,
  target
}) => {
  const pager = {
    currentPage: 0,
    pages: 0
  };

  const instance = new IntersectionObserver(
    callback,
    {
      root,
      rootMargin,
      threshold: 1
    }
  );

  return {
    observe: () => {
      if (pager.currentPage && pager.currentPage >= pager.pages) {
        return;
      }

      instance.observe(target);
    },
    unobserve: () => {
      instance.unobserve(target);
    },
    disconnect: () => {
      instance.disconnect();
    },
    updatePager: ({
      currentPage,
      pages
    }) => {
      pager.currentPage = currentPage;
      pager.pages = pages;
    }
  };
};

export default observer;
