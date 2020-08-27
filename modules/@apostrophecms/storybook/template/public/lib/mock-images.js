(function() {
  const tags = {
    applyTo: [
      'reduce-earning-muscle-wonder-deciding',
      'lose-boyd-inside-tries-descartes',
      'oriented-smear-bodies-hedge-vermont'
    ],
    tags: [
      {
        label: 'Nature',
        slug: 'nature',
        match: [
          'reduce-earning-muscle-wonder-deciding',
          'lose-boyd-inside-tries-descartes',
          'oriented-smear-bodies-hedge-vermont'
        ]
      },
      {
        label: 'Nurture',
        slug: 'nurture',
        match: [
          'reduce-earning-muscle-wonder-deciding',
          'lose-boyd-inside-tries-descartes',
          'oriented-smear-bodies-hedge-vermont'
        ]
      },
      {
        label: 'Natural',
        slug: 'natural',
        match: [
          'reduce-earning-muscle-wonder-deciding',
          'oriented-smear-bodies-hedge-vermont'
        ]
      },
      {
        label: 'Niceness',
        slug: 'niceness'
      },
      {
        label: 'Nastiness',
        slug: 'nastiness'
      },
      {
        label: 'Nuance',
        slug: 'nuance'
      },
      {
        label: 'Nightly',
        slug: 'nightly'
      },
      {
        label: 'Napkins',
        slug: 'napkins'
      },
      {
        label: 'Neurons',
        slug: 'neurons'
      },
      {
        label: 'Neurosis',
        slug: 'neurosis'
      },
      {
        label: 'New Wave',
        slug: 'new-wave'
      },
      {
        label: 'Nespresso',
        slug: 'nespresso'
      }
    ]
  };
  window.apos.http.getResponses['/api/v1/@apostrophecms/image'] = {
    results: createImages(30)
  };

  function randomNum() {
    return (Math.floor(Math.random() * (6 - 2) + 2)).toString();
  }

  function createImages(num) {
    const images = [];
    for (let i = 0; i < num; i++) {
      const title = 'Some Image Title';
      const alt = 'the alt text';
      const credit = 'Credit Goold';
      const creditUrl = 'https://gooldy.ceo';
      const dim = [ `${randomNum()}00`, `${randomNum()}00` ];
      images.push({
        id: `lesk-${Math.floor(Math.random() * Math.floor(10000)).toString()}`,
        path: `https://picsum.photos/${dim[0]}/${dim[1]}?q=${Math.floor(Math.random() * Math.floor(1000)).toString()}`,
        title,
        alt,
        credit,
        uploadedAt: 'Uploaded: March 6th, 2018',
        fileSize: '345KB',
        dim: `${dim[0]} x ${dim[1]}`,
        creditUrl,
        slug: title.replace(' ', '-').toLowerCase(),
        tags: tags.tags
      });
    };
    return images;
  }
})();
