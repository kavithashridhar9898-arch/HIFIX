import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated } from 'react-native';

const TabAnimationContext = createContext();

export const TabAnimationProvider = ({ children }) => {
  // We use this to track if we're scrolling down or up to animate the tab bar
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Track the scroll direction natively
  // diffClamp keeps the value between 0 and 100
  // When scrolling down, it approaches 100 (hide tab bar)
  // When scrolling up, it drops back to 0 (show tab bar)
  const scrollYClamped = Animated.diffClamp(scrollY, 0, 100);

  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  // We expose a helper to attach to FlatList or ScrollView onScroll event
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  return (
    <TabAnimationContext.Provider value={{ scrollY, scrollYClamped, handleScroll, isTabBarVisible, setIsTabBarVisible }}>
      {children}
    </TabAnimationContext.Provider>
  );
};

export const useTabAnimation = () => useContext(TabAnimationContext);
