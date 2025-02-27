import { CallOverrides } from 'ethers';

export interface ConfigInterface {
  /**
   *Open Lp
   * @param quoteAddr the quote address
   * @param overrides overrides with ethers types
   */
  openLp(quoteAddr?: string, overrides?: CallOverrides): Promise<boolean>;

  /**
   *Is in white list lp
   * @param quoteAddr the quote address
   * @param traders the trader address list
   * @param overrides overrides with ethers types
   */
  inWhiteListLps(quoteAddr: string, traders: string[], overrides?: CallOverrides): Promise<boolean[]>;
}
