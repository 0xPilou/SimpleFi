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
    address public treasury;
    
    uint256 public previousSharePrice;

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
        treasury = IBeefyOptimizerFactory(parentFactory).treasury();


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
        _payPerformanceFees();
        IBeefyVault(beefyVaultAddr).withdraw(_amount);
        previousSharePrice = IBeefyVault(beefyVaultAddr).getPricePerFullShare();
        IERC20(staking).safeTransfer(msg.sender, IERC20(staking).balanceOf(address(this)));
    }
   
    function withdrawAll() external onlyOwner {
        _payPerformanceFees();
        IBeefyVault(beefyVaultAddr).withdrawAll();

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
        if(IBeefyVault(beefyVaultAddr).balance(address(this)) > 0){
            _payPerformanceFees();
        }
        IBeefyVault(beefyVaultAddr).depositAll();
        previousSharePrice = IBeefyVault(beefyVaultAddr).getPricePerFullShare();
    }
    
    function _payPerformanceFees() internal {
        // exclude the FeeCollectors from paying performance fees
        if(feeCollector != address(0)){
            // Calculate profit accumulated
            uint256 currentSharePrice = IBeefyVault(beefyVaultAddr).getPricePerFullShare();
            uint256 mooBalance = IBeefyVault(beefyVaultAddr).balance(address(this));
            uint256 profit = mooBalance.mul(currentSharePrice.sub(previousSharePrice)).div(currentSharePrice);

            // Performance Fees = 10 % of the profit
            uint256 performanceFees = profit.div(10);
`
            // Performance Fees sent to the FeeCollector 
            IBeefyVault(beefyVaultAddr).transfer(feeCollector, performanceFees);
        }
    }

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
}