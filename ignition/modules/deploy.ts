import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CrypTipModule", (m) => {
  const cryptip = m.contract("CrypTip");

  return { cryptip };
});
