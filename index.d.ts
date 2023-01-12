declare module "apostrophe" {
  interface ApostropheModulesOptions {
    "apostrophe-module": {
      playerData: Array<string>
    }
  }

  interface ApostropheModulesApi {
    "apostrophe-module": {
      pushAsset(type: 'script' | 'stylesheet', name: string, options: { when: 'always' | 'lean' | 'user' }): void
    }
  }

  type ApostropheModuleSelf<Name extends keyof ApostropheModulesApi> = ApostropheModulesApi[Name]
  type ApostropheModuleOptions<Name extends keyof ApostropheModulesOptions> = ApostropheModulesOptions[Name]

  interface ApostropheModule<Name extends keyof ApostropheModulesApi, NameOptions extends keyof ApostropheModulesOptions> {
    wrapperTemplate?: string;
    label?: string;
    extend?: string;
    name: Name;

    beforeConstruct?(self: ApostropheModuleSelf<Name>, options: ApostropheModuleOptions<NameOptions>): unknown | Promise<unknown>;

    construct?(self: ApostropheModuleSelf<Name>, options: ApostropheModuleOptions<NameOptions>): unknown | Promise<unknown>;

    afterConstruct?(self: ApostropheModuleSelf<Name>): unknown | Promise<unknown>;
  }

  type DefaultModuleExtend = "apostrophe-module"

  export function createModule<
    Name extends keyof ApostropheModulesApi = DefaultModuleExtend,
    NameOptions extends keyof ApostropheModulesOptions = (Name extends keyof ApostropheModulesOptions ? Name : DefaultModuleExtend)
  >(
    module: ApostropheModule<Name, NameOptions> & Partial<ApostropheModulesOptions[NameOptions]>
  ): ApostropheModule<Name, NameOptions>
}
