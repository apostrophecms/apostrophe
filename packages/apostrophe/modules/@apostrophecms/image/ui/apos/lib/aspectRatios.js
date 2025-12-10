const DEFAULT_ASPECT_RATIOS = [
  [ 1, 1 ],
  [ 2, 3 ],
  [ 3, 4 ],
  [ 3, 2 ],
  [ 4, 3 ],
  [ 5, 4 ],
  [ 16, 9 ],
  [ 9, 16 ],
  [ 4, 5 ]
];

export default (freeLabel) => {
  const freeAspectRatio = {
    label: freeLabel,
    value: 0
  };

  return [
    freeAspectRatio,
    ...DEFAULT_ASPECT_RATIOS.map(([ width, height ]) => ({
      label: `${width}:${height}`,
      value: width / height
    }))
  ];
};
