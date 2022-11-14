// SPDX-License-Identifier: BUSL-1.1

pragma solidity =0.8.17;

import {EthVault} from '../vaults/EthVault.sol';
import {IEthValidatorsRegistry} from '../interfaces/IEthValidatorsRegistry.sol';
import {IRegistry} from '../interfaces/IRegistry.sol';
import {IKeeper} from '../interfaces/IKeeper.sol';

contract EthVaultV2Mock is EthVault {
  uint128 public newVar;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor(
    IKeeper _keeper,
    IRegistry _registry,
    IEthValidatorsRegistry _validatorsRegistry
  ) EthVault(_keeper, _registry, _validatorsRegistry) {}

  function upgrade(bytes calldata data) external virtual reinitializer(2) {
    (newVar) = abi.decode(data, (uint128));
  }

  function somethingNew() external pure returns (bool) {
    return true;
  }
}
