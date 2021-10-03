// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

interface IBeefyOptimizerFactory {


    function treasury() external returns(address);

    function addStrategy(address _beefyVaultAddr) external returns(uint256);

    function createBeefyOptimizer(uint256 _poolId) external returns(address);

    function getOptimizerCount() external view returns(uint);
    
    function getStrategyCount() external view returns(uint);

    function getOwnerOptimizers(address _owner) external view returns(address[] memory);

    function getFeeCollectorByStrategyID(uint256 _poolId) external view returns(address);
}



