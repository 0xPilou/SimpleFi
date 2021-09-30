// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

interface IUniV2Optimizer {
  
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
    function staking() external view returns (address);
    function reward() external view returns (address);
    function stakingRewardAddr() external view returns (address);
    function uniV2RouterAddr() external view returns (address);
    function ammZapAddr() external view returns (address);
    function feeCollector() external view returns (address);
    function parentFactory() external view returns (address);

    function staked() external view returns (uint256);
    
    function zapAndStake(address _tokenToZap, uint256 _amountToZap) external;
    function stake(uint256 _amount) external;
    
    function withdraw(uint256 _amount) external;

    function reinvest(address _desiredToken) external;

    function harvest() external;
   
    function exitAvalanche() external;
    
    function recoverERC20(address _ERC20) external;

    function getPendingRewards() external view;
}    
