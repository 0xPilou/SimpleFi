// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

interface IUniV2Optimizer {
  
    function staked() external view returns (uint256);
    function staking() external view returns (address);
    function ammZapAddr() external view returns (address);
    
    function stake(uint256 _amount) external;
    
    function withdraw(uint256 _amount) external;

    function reinvest(address _desiredToken) external;

    function harvest() external;
   
    function exitAvalanche() external;
    
    function recoverERC20(address _ERC20) external;

    function getPendingRewards() external view;
}    
