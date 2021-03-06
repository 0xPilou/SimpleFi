pragma solidity ^0.8.0;

import "./AmmZap.sol";
import 'openzeppelin-solidity/contracts/access/Ownable.sol';


contract AmmZapFactory is Ownable {
    address[] public ammZaps;
    mapping(address => address) public zapRouterRegistry; 

    function createAmmZap(address _ammRouterAddr) external onlyOwner returns(address newAmmZap) {
        require(zapRouterRegistry[_ammRouterAddr] == address(0), "This router already has an AmmZap deployed.");
        AmmZap ammZap = new AmmZap(_ammRouterAddr);
        ammZaps.push(address(ammZap));
        zapRouterRegistry[_ammRouterAddr] = address(ammZap);
        return address(ammZap);
    }

    function getAmmZapByRouter(address _ammRouterAddr) external view returns(address) {
        return zapRouterRegistry[_ammRouterAddr];
    }

    function getAmmZapCount() external view returns(uint) {
        return ammZaps.length;
    } 
}

