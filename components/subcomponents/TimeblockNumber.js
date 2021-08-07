import React, {useEffect} from 'react'
import {StyleSheet, Text} from 'react-native'
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated'

/**
 * This component holds the number to the left of the timeblock screen
 */
const TimeblockNumber = ({ time, marginBottom }) => {

    return (
            <Text style={[styles.text, {marginBottom: marginBottom}]}>
                {time.substring(0, time.indexOf(" "))}
            </Text>
    )
}

const styles = StyleSheet.create({
    text: {
        fontSize: 20,
        textAlign: 'left',
        marginLeft: "6%"
    }
})

export default TimeblockNumber
