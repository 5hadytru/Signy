/**
    This file contains the universal navbar component which contains the hamburger menu btn and back btn that are always at
    the top of the screen
 */

import {View, StyleSheet} from 'react-native'
import React from 'react'
import Icon from 'react-native-vector-icons/FontAwesome'


const UniversalNavbar = ({ navigation }) => {
    return (
        <View style={{ flexDirection: 'row', justifyContent: "space-between", backgroundColor: "white", paddingTop: "2%", paddingHorizontal: "3%"}}>
            <Icon name="arrow-left" size={30} onPress={() => navigation.goBack()} style={styles.backBtn} />
            <Icon name="bars" size={30} onPress={() => navigation.openDrawer()} style={styles.hamburger} />
        </View>
    )
}

const styles = StyleSheet.create({
    backBtn: {
        color: 'black'
    },
    hamburger: {
        color: "black"
    }
});

export default UniversalNavbar
