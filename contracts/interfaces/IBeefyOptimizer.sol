pragma solidity ^0.8.0;

interface IBeefyOptimizer {

    function staking() external returns(address);
    function beefyVaultAddr() external returns(address);
    function feeCollector() external returns(address);
    function parentFactory() external returns(address);

    function staked() external returns(uint256);

    function stake(uint256 _amount) external;
    
    function withdraw(uint256 _amount) external;
   
    function withdrawAll() external;
    
    function recoverERC20(address _ERC20) external;
}