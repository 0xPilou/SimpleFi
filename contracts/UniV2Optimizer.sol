// "SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.8.0;

import 'openzeppelin-solidity/contracts/utils/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/utils/Context.sol';
import 'openzeppelin-solidity/contracts/access/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol';
import './interfaces/IStakingRewards.sol';
import './interfaces/IUniswapV2Router.sol';
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
    
    /**
     * @dev Token swap route addresses 
     */    
    address[] public rewardToTokenA;
    address[] public rewardToTokenB;

    uint256 public staked = 0;

    /**
     * @dev Initializes the strategy for the given protocol
     */
    constructor(
        address _tokenA,
        address _tokenB,
        address _staking,
        address _reward,
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        staking = _staking;
        reward = _reward;
        stakingRewardAddr = _stakingRewardAddr;
        uniV2RouterAddr = _uniV2RouterAddr;
        rewardToTokenA = [_reward, _tokenA];
        rewardToTokenB = [_reward, _tokenB];
        
        IERC20(_staking).safeApprove(_stakingRewardAddr, 0);
        IERC20(_staking).safeApprove(_stakingRewardAddr, MAX_INT);
        IERC20(_reward).safeApprove(_uniV2RouterAddr, 0);
        IERC20(_reward).safeApprove(_uniV2RouterAddr, MAX_INT);        
        IERC20(_tokenA).safeApprove(_uniV2RouterAddr, 0);
        IERC20(_tokenA).safeApprove(_uniV2RouterAddr, MAX_INT);
        IERC20(_tokenB).safeApprove(_uniV2RouterAddr, 0);
        IERC20(_tokenB).safeApprove(_uniV2RouterAddr, MAX_INT);
        
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
        _splitRewardToStaking();
        _mintStaking();
        _stakeAll();
    }
   
    function exitAvalanche() external onlyOwner {
        //_exit();
        IStakingRewards(stakingRewardAddr).exit();
        staked = 0;

        _splitRewardToStaking();
        _mintStaking();

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

    //function _withdraw(uint256 _amount) internal {
    //    IStakingRewards(stakingRewardAddr).withdraw(_amount);
    //    staked = staked.sub(_amount);
    //}

    //function _exit() internal {
    //    IStakingRewards(stakingRewardAddr).exit();
    //    staked = 0;
    //}

    function _claimReward() internal {
        if(staked > 0) {
            IStakingRewards(stakingRewardAddr).getReward();
        }
    } 
    
    function _splitRewardToStaking() internal {
        if(IERC20(reward).balanceOf(address(this)) > 0){
            uint256 rewardSplit = IERC20(reward).balanceOf(address(this)).div(2);
            if(reward != tokenA){
                IUniswapV2Router(uniV2RouterAddr).swapExactTokensForTokens(
                    rewardSplit,
                    0,
                    rewardToTokenA,
                    address(this),
                    block.timestamp.add(600)
                );
            }
            if(reward != tokenB){
                IUniswapV2Router(uniV2RouterAddr).swapExactTokensForTokens(
                    IERC20(reward).balanceOf(address(this)),
                    0,
                    rewardToTokenB,
                    address(this),
                    block.timestamp.add(600)
                );
            }              
        }
    }

    function _mintStaking() internal {
        uint256 balanceA = IERC20(tokenA).balanceOf(address(this));
        uint256 balanceB = IERC20(tokenB).balanceOf(address(this));
        IUniswapV2Router(uniV2RouterAddr).addLiquidity(
            address(IERC20(tokenA)),
            address(IERC20(tokenB)),
            balanceA,
            balanceB,
            1,
            1,
            address(this),
            block.timestamp.add(600)
        );
    }
}    
