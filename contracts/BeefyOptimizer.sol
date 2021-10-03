pragma solidity ^0.8.0;

import 'openzeppelin-solidity/contracts/utils/Context.sol';
import 'openzeppelin-solidity/contracts/access/Ownable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol';
import 'openzeppelin-solidity/contracts/utils/math/SafeMath.sol';

import "./interfaces/IBeefyVault.sol";


contract BeefyOptimizer is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    
    uint256 constant MAX_INT = 2**256 - 1;
   
    /**
     * @dev Tokens addresses
     */    
    address public staking;

    /**
     * @dev Interfacing contracts addresses
     */
    address public beefyVaultAddr;

    address public feeCollector;
    address public parentFactory;
    
    uint256 public staked = 0;

    /**
     * @dev Initializes the strategy for the given protocol
     */
    constructor(
        address _beefyVaultAddr,
        address _feeCollector
    ) { 
        beefyVaultAddr = _beefyVaultAddr;
        feeCollector = _feeCollector;
        parentFactory = msg.sender;

        staking = IBeefyVault(_beefyVaultAddr).want();
       
        IERC20(staking).safeApprove(_beefyVaultAddr, 0);
        IERC20(staking).safeApprove(_beefyVaultAddr, MAX_INT);      
    }

    function stake(uint256 _amount) external onlyOwner {
        require(IERC20(staking).balanceOf(address(msg.sender)) >= _amount);
        IERC20(staking).safeTransferFrom(msg.sender, address(this), _amount);
        _stakeAll();
    }
    
    function withdraw(uint256 _amount) external onlyOwner {
        IBeefyVault(beefyVaultAddr).withdraw(_amount);
        staked = staked.sub(_amount);
        IERC20(staking).safeTransfer(msg.sender, IERC20(staking).balanceOf(address(this)));
    }
   
    function withdrawAll() external onlyOwner {
        IBeefyVault(beefyVaultAddr).withdrawAll();
        staked = 0;
        if(IERC20(staking).balanceOf(address(this)) > 0){
            IERC20(staking).safeTransfer(msg.sender, IERC20(staking).balanceOf(address(this)));
        }
    }
    
    function recoverERC20(address _ERC20) external onlyOwner {
        if(IERC20(_ERC20).balanceOf(address(this)) > 0){
            IERC20(_ERC20).safeTransfer(msg.sender, IERC20(_ERC20).balanceOf(address(this)));
        }        
    }

    function _stakeAll() internal {
        staked = staked.add(IERC20(staking).balanceOf(address(this)));
        IBeefyVault(beefyVaultAddr).depositAll();
    }

//    // To review
//    function getPendingRewards() external view returns(uint256) {
//        return IStakingRewards(stakingRewardAddr).earned(address(this));
//    }

//    function reinvest(address _desiredToken) external onlyOwner {
//        require(_desiredToken != reward, "Reward token is already the expected token");
//        _claimReward();
//        if(IERC20(reward).balanceOf(address(this)) > 0){
//            address[] memory rewardToDesiredToken = new address[](2);
//            rewardToDesiredToken[0] = reward;
//            rewardToDesiredToken[1] = _desiredToken;
//            IUniswapV2Router(uniV2RouterAddr).swapExactTokensForTokens(
//                IERC20(reward).balanceOf(address(this)),
//                0,
//                rewardToDesiredToken,
//                address(this),
//                block.timestamp.add(600)
//            );
//        }     
//    }

//    function _payPerformanceFees() internal {
//        // exclude the FeeCollectors from paying performance fees
//        if(feeCollector != address(0)){
//            address treasury = IUniV2OptimizerFactory(parentFactory).treasury();
//            uint256 rewardBalance = IERC20(reward).balanceOf(address(this));
//
//            // Performance Fees = 10 % of the yield
//            uint256 performanceFees = rewardBalance.div(10);
//
//            // Performance Fees sent to the FeeCollector 
//            IERC20(reward).safeTransfer(feeCollector, performanceFees);
//            ITreasury(treasury).compoundFeeCollector(feeCollector);
//        }
//    }  
}