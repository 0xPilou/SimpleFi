// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

import 'openzeppelin-solidity/contracts/utils/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/utils/Context.sol';
import 'openzeppelin-solidity/contracts/access/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/IStakingRewards.sol';
import './interfaces/IUniswapV2Router.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IAmmZap.sol';

contract UniV2Optimizer is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    
    uint256 constant MAX_INT = 2**256 - 1;
   
    /**
     * @dev Tokens addresses
     */    
    address public tokenA;
    address public tokenB;
    address public staking;
    address public reward;

    /**
     * @dev Interfacing contracts addresses
     */
    address public stakingRewardAddr;
    address public uniV2RouterAddr;
    address public ammZapAddr;

    address public feeCollector;
    
    uint256 public staked = 0;

    /**
     * @dev Initializes the strategy for the given protocol
     */
    constructor(
        address _stakingRewardAddr,
        address _uniV2RouterAddr,
        address _ammZapAddr,
        address _feeCollector
    ) { 
        stakingRewardAddr = _stakingRewardAddr;
        uniV2RouterAddr = _uniV2RouterAddr;
        ammZapAddr = _ammZapAddr;
        feeCollector = _feeCollector;
        staking = IStakingRewards(stakingRewardAddr).stakingToken();
        reward = IStakingRewards(stakingRewardAddr).rewardsToken();
        tokenA = IUniswapV2Pair(staking).token0();
        tokenB = IUniswapV2Pair(staking).token1();
       
        IERC20(staking).safeApprove(_stakingRewardAddr, 0);
        IERC20(staking).safeApprove(_stakingRewardAddr, MAX_INT);
        IERC20(reward).safeApprove(_uniV2RouterAddr, 0);
        IERC20(reward).safeApprove(_uniV2RouterAddr, MAX_INT);        
        IERC20(tokenA).safeApprove(_uniV2RouterAddr, 0);
        IERC20(tokenA).safeApprove(_uniV2RouterAddr, MAX_INT);
        IERC20(tokenB).safeApprove(_uniV2RouterAddr, 0);
        IERC20(tokenB).safeApprove(_uniV2RouterAddr, MAX_INT);
        
    }

    function stake(uint256 _amount) external onlyOwner {
        require(IERC20(staking).balanceOf(address(msg.sender)) >= _amount);
        IERC20(staking).safeTransferFrom(msg.sender, address(this), _amount);
        _stakeAll();
    }
    
    function withdraw(uint256 _amount) external onlyOwner {
        IStakingRewards(stakingRewardAddr).withdraw(_amount);
        staked = staked.sub(_amount);
        IERC20(staking).safeTransfer(msg.sender, _amount);
    }

    function reinvest(address _desiredToken) external onlyOwner {
        require(_desiredToken != reward, "Reward token is already the expected token");
        _claimReward();
        if(IERC20(reward).balanceOf(address(this)) > 0){
            address[] memory rewardToDesiredToken = new address[](2);
            rewardToDesiredToken[0] = reward;
            rewardToDesiredToken[1] = _desiredToken;
            IUniswapV2Router(uniV2RouterAddr).swapExactTokensForTokens(
                IERC20(reward).balanceOf(address(this)),
                0,
                rewardToDesiredToken,
                address(this),
                block.timestamp.add(600)
            );
        }     
    }

    function harvest() external onlyOwner {
        _claimReward();
        uint256 amountToZap = IERC20(reward).balanceOf(address(this));
        IERC20(reward).safeApprove(ammZapAddr, amountToZap);        
        IAmmZap(ammZapAddr).zap(reward, tokenA, tokenB, amountToZap);
        _stakeAll();
    }
   
    function exitAvalanche() external onlyOwner {
        _claimReward();
        IStakingRewards(stakingRewardAddr).exit();
        staked = 0;
        uint256 amountToZap = IERC20(reward).balanceOf(address(this));
        IERC20(reward).safeApprove(ammZapAddr, amountToZap);        
        IAmmZap(ammZapAddr).zap(reward, tokenA, tokenB, amountToZap);

        if(IERC20(staking).balanceOf(address(this)) > 0){
            IERC20(staking).safeTransfer(msg.sender, IERC20(staking).balanceOf(address(this)));
        }
        if(IERC20(tokenA).balanceOf(address(this)) > 0){
            IERC20(tokenA).safeTransfer(msg.sender, IERC20(tokenA).balanceOf(address(this)));
        }
        if(IERC20(tokenB).balanceOf(address(this)) > 0){
            IERC20(tokenB).safeTransfer(msg.sender, IERC20(tokenB).balanceOf(address(this)));
        }
        if(IERC20(reward).balanceOf(address(this)) > 0){
            IERC20(reward).safeTransfer(msg.sender, IERC20(reward).balanceOf(address(this)));
        }
    }
    
    function recoverERC20(address _ERC20) external onlyOwner {
        if(IERC20(_ERC20).balanceOf(address(this)) > 0){
            IERC20(_ERC20).safeTransfer(msg.sender, IERC20(_ERC20).balanceOf(address(this)));
        }        
    }

    function getPendingRewards() external view onlyOwner returns(uint256) {
        uint256 pendingReward = IStakingRewards(stakingRewardAddr).earned(address(this));
        return pendingReward;
    }

    function _stakeAll() internal {
        staked = staked.add(IERC20(staking).balanceOf(address(this)));
        IStakingRewards(stakingRewardAddr).stake(IERC20(staking).balanceOf(address(this)));
    }

    function _claimReward() internal {
        if(staked > 0) {
            IStakingRewards(stakingRewardAddr).getReward();
            uint256 rewardBalance = IERC20(reward).balanceOf(address(this));

            // Performance Fees = 10 %
            uint256 performanceFees = rewardBalance.div(10);

            // Performance Fees sent to the FeeCollector 
            IERC20(reward).safeTransfer(feeCollector, performanceFees);
        }
    } 
}    
