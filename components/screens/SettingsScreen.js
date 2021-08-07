import {Text, View} from 'react-native'
import React from 'react'

import UniversalNavbar from '../subcomponents/UniversalNavbar'


/**
 * Functionality
 *      -Sidebar order
 *      -Back Up Data
 *              Explain automatic 24 hr backup and when to back up
 *      - Color selection
 *              A couple colors that make up all the app's colors
 *      - Font selection
 *      - Log off
 */

const SettingsScreen = ({ navigation }) => {
    return (
        <View>
            <UniversalNavbar navigation={navigation} />
        </View>
    )
}

export default SettingsScreen