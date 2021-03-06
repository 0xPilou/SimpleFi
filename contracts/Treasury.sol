pragma solidity ^0.8.0;


import 'openzeppelin-solidity/contracts/utils/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/utils/SafeERC20.sol';
import 'openzeppelin-solidity/contracts/utils/Context.sol';
import 'openzeppelin-solidity/contracts/access/Ownable.sol';

import "./interfaces/IUniV2Optimizer.sol";
import "./interfaces/IUniV2OptimizerFactory.sol";
import "./interfaces/IBeefyOptimizerFactory.sol";
import './interfaces/IAmmZap.sol';

contract Treasury is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address constant WETH = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619; 

    // Mapping storing the previous amount of token staked (before dividends payment) of a given Fee Collector
    mapping(address => uint256) public previousFeeCollectorStake;

    // Mapping storing the retirement status of a given FeeCollector
    mapping(address => bool) public retirementStatus;

    function createUniV2Strategy(
        address _uniV2OptmizerFactory,
        address _stakingRewardAddr,
        address _uniV2RouterAddr
    ) external onlyOwner {
        IUniV2OptimizerFactory(_uniV2OptmizerFactory).addStrategy(_stakingRewardAddr, _uniV2RouterAddr);
    }

    function createBeefyStrategy(
        address _beefyOptimizerFactory,
        address _beefyVaultAddr
    ) external onlyOwner {
        IBeefyOptimizerFactory(_beefyOptimizerFactory).addStrategy(_beefyVaultAddr);
    }

    // Compounds the FeeCollector optimizer and pay the dividends to the stakers
    function compoundFeeCollector(address _feeCollector) external {
        if(retirementStatus[_feeCollector] == false){
            IUniV2Optimizer(_feeCollector).harvest();
            _payDividends(_feeCollector);
        }
    }

    // This function terminate a FeeCollector operation
    // It is called once the strategy corresponding to the FeeCollector no longer yields reward
    function retireFeeCollector(address _feeCollector, address _migrateTo) external onlyOwner {
        // Can only retire a FeeCollector in operation
        require(retirementStatus[_feeCollector] == false);

        // Can only migrate Fees to another FeeCollector
        require(IUniV2Optimizer(_migrateTo).feeCollector() == address(0));

        uint256 totalStake = IUniV2Optimizer(_feeCollector).staked();
        address stakingToken = IUniV2Optimizer(_feeCollector).staking();

        address ammZap = IUniV2Optimizer(_feeCollector).ammZapAddr();
        
        // Withdraw the total stake
        IUniV2Optimizer(_feeCollector).withdraw(totalStake);

        // Unzap Staking token into DAI tokens
        IERC20(stakingToken).safeApprove(ammZap, totalStake); 
        IAmmZap(ammZap).unzap(stakingToken, WETH, totalStake);

        // Zap and stake into the replacement FeeCollector 
        uint256 wethAmount = IERC20(WETH).balanceOf(address(this));

        IERC20(WETH).safeApprove(_migrateTo, wethAmount); 
        IUniV2Optimizer(_migrateTo).zapAndStake(WETH, wethAmount);
        
        // Set the FeeCollector Retirement status to true
        retirementStatus[_feeCollector] = true;
    }

    function _payDividends(address _feeCollector) internal {
        uint256 currentStake = IUniV2Optimizer(_feeCollector).staked();
        uint256 previousStake = previousFeeCollectorStake[_feeCollector];

        if(currentStake > previousStake){

            // Dividends are paid in the form of staking LP tokens
            address dividendCurrency = IUniV2Optimizer(_feeCollector).staking();
            
            // The dividends amount correspond to 50% of the yield since the last dividend payment
            uint256 dividends = currentStake.sub(previousStake).div(2);

            // Dividends are withdrawn from the FeeCollector optimizer
            IUniV2Optimizer(_feeCollector).withdraw(dividends);

            // Register the new amount staked 
            previousFeeCollectorStake[_feeCollector] = IUniV2Optimizer(_feeCollector).staked();
            IERC20(dividendCurrency).safeTransfer(0x70997970C51812dc3A010C7d01b50e0d17dc79C8, dividends);
        }
    }
}
