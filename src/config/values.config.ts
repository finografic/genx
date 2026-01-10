export interface DefaultValuesConfig {
  /** Default scope for new packages (accepts `finografic` or `@finografic`) */
  scope: string;

  /** Default description placeholder / initial value */
  description: string;

  /** Default author values for new packages */
  author: {
    name: string;
    email: string;
    url: string;
  };

  /**
   * Author prompt format (single prompt).
   * Example: `Name | email@example.com | https://example.com`
   */
  authorPromptDelimiter: string;
}

export const defaultValuesConfig: DefaultValuesConfig = {
  /** Default scope for new packages (accepts `finografic` or `@finografic`) */
  scope: '@finografic',

  /** Default description placeholder / initial value */
  description: 'A cool new package for the finografic ecosystem',

  /** Default author values for new packages */
  author: {
    name: 'Justin Rankin',
    email: 'justin.blair.rankin@gmail.com',
    url: 'http://finografic.github.com/cv-justin-rankin',
  },

  /**
   * Author prompt format (single prompt).
   * Example: `Name | email@example.com | https://example.com`
   */
  authorPromptDelimiter: '|',
};
