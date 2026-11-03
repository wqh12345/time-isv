import { apiAuth, getCodeScope } from '../../api/api'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBaseUrl } from '../../config'
import { goToLarkLoginPage, getUrlState } from '../../util/util'
import { Toast } from "antd-mobile";


const MbLogin = () => {
  
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.hasOwnProperty('jwtMiToken')) {
      navigate("/mb/home",{replace:true})
      return
    }
  }, []);

  const getToken = async (data, url) => {
    const res = await apiAuth(data)
    if (res && res.data.success && res.data.result !== null) {
      localStorage.setItem('jwtMiTimer', res.data.result.expiresAccess)
      localStorage.setItem('jwtMiToken', res.data.result.tokenType + res.data.result.accessToken)
      localStorage.setItem('jwtMiRefreshTimer', res.data.result.expiresRefresh)
      localStorage.setItem('jwtMiRefreshToken', res.data.result.refreshToken)
      let timer = setTimeout(() => {
        clearTimeout(timer)
        window.location.href = decodeURIComponent(url)
      }, 10)
    }
    
  }

  const getScope = async (state) => {
    const scope = await getCodeScope()
      if (scope && scope.data.success && scope.data.result !== null) {
        goToLarkLoginPage(getBaseUrl().APPID, state, scope.data.result)
      } else {
        goToLarkLoginPage(getBaseUrl().APPID, state)
      }
  }

  if (!window.h5sdk) {
    if (localStorage.hasOwnProperty('jwtMiToken')) return

    if (window.location.href.indexOf('code') !== -1) {
      const store = getUrlState()
      if (store.code) {
        const data = {
          code: store.code
        }
        getToken(data, store.state)
      }
    } else {
      const pathname = window.location.pathname.length < 2 ? '/mb/home' : window.location.pathname
      const state = window.location.origin + pathname
      getScope(state)
    }
    console.log("invalid h5sdk");
    return;
  }
  window.h5sdk.ready(() => { // ready方法不需要每次都调用
    window.tt.requestAuthCode({
      appId: getBaseUrl().APPID,
      success: async (info) => {
        const data = {
          code: info.code
        }
        // console.log(info);
        const res = await apiAuth(data)
        // console.log(res);
        if (res && res.data.success && res.data.result !== null) {
          localStorage.setItem('jwtMiTimer', res.data.result.expiresAccess)
          localStorage.setItem('jwtMiToken', res.data.result.tokenType + res.data.result.accessToken)
          localStorage.setItem('jwtMiRefreshTimer', res.data.result.expiresRefresh)
          localStorage.setItem('jwtMiRefreshToken', res.data.result.refreshToken)
          let timer = setTimeout(() => {
            clearTimeout(timer)
            navigate(`/mb/home`)
          }, 10)
        }
      },
      fail: (error) => {
        console.error(error)
      }
    });
  });
  return (
    <div id="login_container"></div>
	)
}
 
export default MbLogin