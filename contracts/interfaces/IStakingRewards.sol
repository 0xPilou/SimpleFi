pragma solidity ^0.8.0;

interface IStakingRewards {
    function earned(address account) external view returns (uint256);
    function stake(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getReward() external;
    function exit() external;
    function stakingToken() external view returns (address);
    function rewardsToken() external view returns (address);
}