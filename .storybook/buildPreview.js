const fs = require('fs');
const path = require('path');

const glob = require('glob');

const IMPORTS_PLACEHOLDER = /(\/\/ IMPORTS)/g;
const COMPONENTS_PLACEHOLDER = /(\/\/ COMPONENTS)/g;

const ICON_DIR = path.join(
  process.cwd(),
  'node_modules',
  'vue-material-design-icons'
);

const getVueComponents = () => {
  const ui = path.join(
    process.cwd(),
    'lib',
    'modules',
    '@apostrophecms',
    'ui',
    '**/*.vue'
  );
  return glob.sync(ui);
};

const getIcons = () => {
  const icons = path.join(
    process.cwd(),
    'node_modules',
    'vue-material-design-icons',
    '**/*.vue'
  );
  return glob.sync(icons);
};

const buildComponentData = filepath => {
  const name = path.basename(filepath, '.vue');
  return {
    name,
    componentName: name,
    filepath
  };
};

const buildIconData = filepath => {
  const name = path.basename(filepath, '.vue');
  const iconName = name
    .replace(/[A-Z]/, letter => `${letter.toLowerCase()}`)
    .replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  return {
    name,
    componentName: `${iconName}-icon`,
    filepath
  };
};

const importThing = ({ name, filepath }) =>
  `import ${name} from "${filepath}";\n`;

const registerThing = ({ componentName, name }) =>
  `Vue.component('${componentName}', ${name});\n`;

const build = () => {
  console.log('apostrophe-storybook: Building preview.js file...');

  const template = fs.readFileSync(`${__dirname}/preview.tmpl.js`, 'UTF-8');

  const vueComponents = getVueComponents();
  const vueComponentData = vueComponents.map(component =>
    buildComponentData(component)
  );

  const icons = getIcons();
  const iconData = icons.map(icon => buildIconData(icon));

  const imports = [...vueComponentData, ...iconData]
    .map(thing => importThing(thing))
    .join('');

  const components = [...vueComponentData, ...iconData]
    .map(thing => registerThing(thing))
    .join('');

  const preview = template
    .replace(IMPORTS_PLACEHOLDER, imports)
    .replace(COMPONENTS_PLACEHOLDER, components);

  try {
    const file = path.join(__dirname, 'preview.js');
    fs.writeFileSync(file, preview);
    console.log(`DONE! Saved ${file}`);
    console.log('Starting storybook...');
  } catch (e) {
    console.error(e);
  }
};

module.exports = build();
