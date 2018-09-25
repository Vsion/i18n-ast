/**
 * Licensed Materials - Property of tenxcloud.com
 * (C) Copyright 2016 TenxCloud. All Rights Reserved.
 *
 * TenxFlowList component
 *
 * v0.1 - 2016-10-08
 * @author GaoJian
 */
import React, { Component, PropTypes } from 'react'
import { Alert, Menu, Button, Card, Input, Tooltip, Dropdown, Modal, Spin, Checkbox } from 'antd'
import { Link, browserHistory } from 'react-router'
import QueueAnim from 'rc-queue-anim'
import { connect } from 'react-redux'
import { injectIntl, FormattedMessage, defineMessages } from 'react-intl'
import {
  getTenxFlowList, deleteTenxFlowSingle, getTenxflowBuildLastLogs,
  CreateTenxflowBuild, getTenxflowBuildDetailLogs, changeTenxFlowStatus,
  changeFlowStatus, getRepoBranchesAndTagsByProjectId,
  deleteTenxFlow
} from '../../../actions/cicd_flow'
import { checkImage } from '../../../actions/app_center'
import { DEFAULT_REGISTRY } from '../../../constants'
import CreateTenxFlow from '../TenxFlow/CreateTenxFlow.js'
import TenxFlowBuildLog from '../TenxFlow/TenxFlowBuildLog'
import moment from 'moment'
import './style/BuildImageList.less'
import cloneDeep from 'lodash/cloneDeep'
import findIndex from 'lodash/findIndex'
import NotificationHandler from '../../../components/Notification'
import Socket from '../../Websocket/socketIo'
import PopTabSelect from '../../PopTabSelect'
import Title from '../../Title'
import { parseQueryStringToObject } from '../../../common/tools'

const PopTab = PopTabSelect.Tab;
const PopOption = PopTabSelect.Option;
const SubMenu = Menu.SubMenu
const MenuItemGroup = Menu.ItemGroup

let menusText = defineMessages({
  search: {
    id: 'CICD.Tenxflow.TenxFlowList.search',
    defaultMessage: '搜索',
  },
  name: {
    id: 'CICD.Tenxflow.TenxFlowList.name',
    defaultMessage: '名称',
  },
  updateTime: {
    id: 'CICD.Tenxflow.TenxFlowList.updateTime',
    defaultMessage: '上次构建时间',
  },
  status: {
    id: 'CICD.Tenxflow.TenxFlowList.status',
    defaultMessage: '构建状态',
  },
  opera: {
    id: 'CICD.Tenxflow.TenxFlowList.opera',
    defaultMessage: '操作',
  },
  tooltip: {
    id: 'CICD.Tenxflow.BuildImage.tooltip',
    defaultMessage: '构建镜像是流水线中常被创建的子任务，指可将源代码仓库包括代码GitHub、GitLab、Gogs、SVN中的代码通过代码库中的Dockerfile或云端的Dockerfile 构建成镜像，默认将构建后的镜像存放到镜像仓库--私有空间。',
  },
  create: {
    id: 'CICD.Tenxflow.BuildImage.create',
    defaultMessage: '构建镜像',
  },
  deloyLog: {
    id: 'CICD.Tenxflow.TenxFlowList.deloyLog',
    defaultMessage: '执行记录',
  },
  deloyStart: {
    id: 'CICD.Tenxflow.BuildImage.deloyStart',
    defaultMessage: '立即构建',
  },
  delete: {
    id: 'CICD.Tenxflow.BuildImage.delete',
    defaultMessage: '删除构建',
  },
  code: {
    id: 'CICD.Tenxflow.BuildImage.code',
    defaultMessage: '代码源',
  },
  branch: {
    id: 'CICD.Tenxflow.BuildImage.branch',
    defaultMessage: '分支',
  },
  image: {
    id: 'CICD.Tenxflow.BuildImage.image',
    defaultMessage: '镜像名称',
  },
  checkImage: {
    id: 'CICD.Tenxflow.BuildImage.checkImage',
    defaultMessage: '查看镜像',
  }

})


function dateFormat(dateString) {
  if (!dateString) {
    return '';
  }
  var timeStr = moment(dateString);
  return timeStr.format("YYYY-MM-DD HH:mm:ss")
}

let MyComponent = React.createClass({
  propTypes: {
    config: React.PropTypes.array,
    scope: React.PropTypes.object
  },
  getInitialState() {
    return {
      delFlowModal: false,
      item: {}
    }
  },
  operaMenuClick: function (item, e) {
    const { scope } = this.props
    if(e.key == 'deloylog111'){
      scope.openTenxFlowDeployLogModal(item.flowId)
      return
    }
    if(e.key == 'checkImage111') {
      const notify = new NotificationHandler()
      if(!item.image) {
        notify.error('镜像不存在，请先执行构建')
        return
      }
      const image = item.project + '/' + item.image
      const config = { registry: DEFAULT_REGISTRY, image }
      let notification = new NotificationHandler()
      this.setState({ showTargeImage: false })
      this.props.checkImage(config, {
        success: {
          func: res => {
            if (res.data.length <= 0) {
              notification.warn('镜像不存在，请先执行构建')
              return
            }
            browserHistory.push(`/app_center/projects/detail/${item.projectId}?imageName=${image}`)
          },
          isAsync: true
        },
        failed: {
          func: res => {
            notification.warn('镜像不存在，请先执行构建')
          },
        },
      })
      return
    }
    //this function for user click the dropdown menu
    this.setState({ delFlowModal: true, item })
    return
  },
  delFlowAction() {
    let { flowId } = this.state.item;
    const { item } = this.state
    const { scope } = this.props;
    const { deleteTenxFlowSingle, getTenxFlowList } = scope.props;
    let notification = new NotificationHandler()
    notification.spin(`删除流水线 ${item.name} 中...`);
    deleteTenxFlowSingle(flowId, {
      success: {
        func: () => {
          notification.close()
          notification.success(`删除 ${item.name} 成功`);
          scope.loadData()
        },
        isAsync: true
      },
      failed: {
        func: (res) => {
          let statusCode = res.statusCode;
          switch (statusCode) {
            case 500:
              break;
          }
          notification.close()
          notification.error(`删除 ${item.name} 失败`);
        }
      }
    })
  },
  showDeloyLog: function (item, e) {
    //this function for show user the deploy log of the tenxflow
    const { scope } = this.props;
    scope.setState({
      TenxFlowDeployLogModal: true
    });
  },
  starFlowBuild(item, index) {
    const { flowId, projectId, defaultBranch } = item
    const { getRepoBranchesAndTagsByProjectId } = this.props.scope.props
    const notification = new NotificationHandler()
    if (this.props.config) {
      for (let i in this.props.config) {
        let stage = this.props.config[i]
        if (stage.flowId === flowId) {
          if (typeof (stage.stagesCount) === 'number' && stage.stagesCount < 1) {
            notification.error('请先添加构建子任务')
            return
          }
        }
      }
    }
    if (projectId) {
      getRepoBranchesAndTagsByProjectId(projectId, {
        failed: {
          func: res => {
            if (res.statusCode == 500) {
              return notification.error('代码仓库暂时无法访问，请检查相关配置后重试')
            }
          }
        }
      })
    }
  },
  startBuildStage(item, index, key, tabKey) {
    const notification = new NotificationHandler()
    const { flowId } = item
    const parentScope = this.props.scope
    const { CreateTenxflowBuild, getTenxflowBuildDetailLogs } = this.props.scope.props
    const options = {}
    if (key && tabKey) {
      options.branch = key
    }
    CreateTenxflowBuild(flowId, { options }, {
      success: {
        func: (res) => {
          getTenxflowBuildDetailLogs(flowId, res.data.results.flowBuildId, {
            success: {
              func: (result) => {
                const flowListState = cloneDeep(parentScope.state.flowListState)
                flowListState[index].status = result.data.results.results[0].status
                parentScope.setState({
                  flowListState
                })
              }
            }
          })
        },
        isAsync: true
      },
      failed: {
        func: (res) => {
          Modal.error({
            title: '构建失败',
            content: (res.message.message)
          });
        }
      }
    })
  },
  renderBuildBtn(item, index) {
    const { projectId, defaultBranch, stagesCount, repoType } = item
    const { repoBranchesAndTags, scope } = this.props
    let targetElement = (
      <Button
        className='logBtn'
        size='large'
        type='primary'
        onClick={() => {
          if (repoType === 'svn') {
            this.startBuildStage(item, index)
            return
          }
          this.starFlowBuild(item, index)
        }}
      >
        <svg className='structure commonImg'>
          {/*@#structure*/}
          <use xlinkHref="#structure"></use>
        </svg> &nbsp;
        <FormattedMessage {...menusText.deloyStart} />
      </Button>
    )
    if (repoType === 'svn') {
      return targetElement
    }
    const tabs = []
    let loading
    const branchesAndTags = repoBranchesAndTags[projectId]
    if (!branchesAndTags || (!branchesAndTags.data.branches && !branchesAndTags.data.tags)) {
      if (stagesCount > 0) {
        tabs.push(<PopOption key="not_found_branches_tags">未找到分支及标签，点击构建</PopOption>)
      }
    } else {
      const { isFetching, data } = branchesAndTags
      loading = isFetching
      const { branches, tags } = data
      for(let key in data) {
        if (data.hasOwnProperty(key)) {
          tabs.push(
            <PopTab key={key} title={key === 'branches' ? '分支' : '标签'}>
              {
                data[key].map(item => {
                  let name = item.branch || item.tag
                  return <PopOption key={name}>{name}</PopOption>
                })
              }
            </PopTab>
          )
        }
      }
    }
    return (
      <PopTabSelect
        placeholder="请输入分支或标签"
        style={{float: 'left'}}
        onChange={this.startBuildStage.bind(this, item, index)}
        targetElement={targetElement}
        getTooltipContainer={() => document.body}
        isShowBuildBtn={true}
        loading={loading}>
        {tabs}
      </PopTabSelect>
    )
  },
  renderDropdownBtn(item, index) {
    const { scope } = this.props
    const dropdown = (
      <Menu onClick={this.operaMenuClick.bind(this, item)} style={{width:'127px'}}>
        <Menu.Item key="checkImage111">
          <i className="anticon anticon-folder-open" style={{marginRight: '5px'}}/>&nbsp;
          <FormattedMessage {...menusText.checkImage}/>
        </Menu.Item>
        <Menu.Item key='deleteFlow111'>
          <i className="anticon anticon-delete" style={{marginRight: '5px'}}/>&nbsp;
          <FormattedMessage {...menusText.delete}/>
        </Menu.Item>
      </Menu>
    );
    return (
      <Dropdown.Button
        overlay={dropdown}
        type='ghost'
        size='large'
        onClick={scope.openTenxFlowDeployLogModal.bind(scope, item.flowId)}
      >
        <span>
          <i className='fa fa-wpforms' />&nbsp;
          <FormattedMessage {...menusText.deloyLog} />
        </span>
      </Dropdown.Button>
    )
  },
  render: function () {
    const { config, scope, isFetching } = this.props;
    const { flowListState } = this.props.scope.state
    if (isFetching) {
      return (
        <div className='loadingBox'>
          <Spin size='large' />
        </div>
      )
    }
    const items = config.map((item, index) => {
      let status = ''
      switch (flowListState[index].status) {
        case 0:
          status = '成功'
          break;
        case 1:
          status = "失败"
          break;
        case 2:
          status = "执行中..."
          break;
        default:
          status = "等待中..."
      }
      return (
        <div className='tenxflowDetail' key={item.name} >
          <div className='name'>
            <Tooltip placement='topLeft' title={item.name}>
              <Link to={`/ci_cd/build_image/tenx_flow_build?flowId=${item.flowId}&status=${flowListState[index].status}`}>
                <span>{item.name}</span>
              </Link>
            </Tooltip>
          </div>
          <div className='time'>
            <span className='timeSpan'>
              <Tooltip placement='topLeft' title={item.lastBuildTime ? dateFormat(item.lastBuildTime) : '-'}>
                <span>{item.lastBuildTime ? dateFormat(item.lastBuildTime) : '-'}</span>
              </Tooltip>
            </span>
          </div>
          <div className='code'>
            <span className='timeSpan'>
              <Tooltip placement='topLeft' title={item.address}>
                <span>{item.address || '-'}</span>
              </Tooltip>
            </span>
          </div>
          <div className='image'>
            <span className='timeSpan'>
              <Tooltip placement='topLeft' title={item.image}>
                <span>{item.image || '-'}</span>
              </Tooltip>
            </span>
          </div>
          <div className={`status status-` + `${flowListState[index].status}`}>
            <span><i className="fa fa-circle"></i>{status}</span>
          </div>
          <div className='opera'>
            {/*<Button className='logBtn' size='large' type='primary' onClick={scope.openTenxFlowDeployLogModal.bind(scope, item.flowId)}>*/}
              {/*<i className='fa fa-wpforms' />&nbsp;*/}
              {/*<FormattedMessage {...menusText.deloyLog} />*/}
            {/*</Button>*/}
            {
              this.renderBuildBtn(item, index)
            }
            {
              this.renderDropdownBtn(item, index)
            }
          </div>
        </div>
      );
    });
    return (
      <div className='tenxflowList'>
        {items}
        <Modal title="删除构建任务" visible={this.state.delFlowModal}
               onOk={() => this.delFlowAction()} onCancel={() => this.setState({ delFlowModal: false })}
        >
          <Alert message="请注意，删除构建任务将清楚所有相关历史数据，且该操作不可恢复" type="warning" showIcon />
          <div className="modalColor" style={{ lineHeight: '30px' }}><i className="anticon anticon-question-circle-o" style={{ marginRight: '8px', marginLeft: '16px' }}></i>
           您确定要删除 {this.state.item.name}?
          </div>
        </Modal>
      </div>
    );
  }
});

class TenxFlowList extends Component {
  constructor(props) {
    super(props);
    this.openCreateTenxFlowModal = this.openCreateTenxFlowModal.bind(this);
    this.closeCreateTenxFlowModal = this.closeCreateTenxFlowModal.bind(this);
    this.openTenxFlowDeployLogModal = this.openTenxFlowDeployLogModal.bind(this);
    this.closeTenxFlowDeployLogModal = this.closeTenxFlowDeployLogModal.bind(this);
    this.onSearchFlow = this.onSearchFlow.bind(this);
    this.loadData = this.loadData.bind(this);
    this.state = {
      createTenxFlowModal: false,
      TenxFlowDeployLogModal: false,
      currentTenxFlow: null,
      currentFlowId: null,
      flowList: [],
      searchingFlag: false,
      allChecked: false
    }
    const queryObj = parseQueryStringToObject(window.location.search)
    if(queryObj.showCard == 'true') {
      this.state.createTenxFlowModal = true
    }
  }

  loadData(callback) {
    const { getTenxFlowList } = this.props;
    const self = this
    getTenxFlowList(1, {
      success: {
        func: (res) => {
          const flowListState = []
          res.data.results.forEach((list, index) => {
            flowListState.push({ status: list.status })
          })
          self.setState({
            flowListState,
            flowList: res.data.results
          })
          if (callback) {
            callback()
          }
        }
      }
    });
  }

  componentWillMount() {
    this.loadData()
  }
  componentDidMount() {
    const { status, buildId, stageId } = this.props.loginUser
    const { flowId, loginUser } = this.props
    const cicdApi = loginUser.info.cicdApi
    this.setState({
    //  websocket: <Socket url={cicdApi.host} protocol={cicdApi.protocol} path={cicdApi.statusPath} onSetup={(socket) => this.onSetup(socket)} />
    })
  }
  componentWillReceiveProps(nextProps) {
    const { isFetching, flowList, currentSpace } = nextProps;
    if (currentSpace && this.props.currentSpace && currentSpace != this.props.currentSpace) {
      this.loadData()
      return
    }
    if (!isFetching && !!flowList) {
      this.setState({
        flowList: flowList
      });
    }
  }

  openCreateTenxFlowModal() {
    //this function for user open the modal of create new tenxflow
    this.setState({
      createTenxFlowModal: true
    });
    setTimeout(function () {
      document.getElementById('flowName').focus()
    }, 500)
  }

  closeCreateTenxFlowModal() {
    //this function for user close the modal of create new tenxflow
    this.setState({
      createTenxFlowModal: false
    });
  }

  openTenxFlowDeployLogModal(flowId) {
    //this function for user open the modal of tenxflow deploy log
    const { getTenxflowBuildLastLogs } = this.props;
    getTenxflowBuildLastLogs(flowId)
    this.setState({
      TenxFlowDeployLogModal: true,
      currentFlowId: flowId
    });
  }

  closeTenxFlowDeployLogModal() {
    //this function for user close the modal of tenxflow deploy log
    this.setState({
      TenxFlowDeployLogModal: false
    });
  }

  onSearchFlow(e) {
    //this function for user search special flow
    let keyword = e.target.value.trim();
    let searchingFlag = false;
    if (keyword.length > 0) {
      searchingFlag = true;
    }
    const { flowList } = this.props;
    let newList = [];
    flowList.map((item) => {
      if (item.name.indexOf(keyword) > -1) {
        newList.push(item);
      }
    });
    this.setState({
      flowList: newList,
      searchingFlag: searchingFlag
    })
  }
  onSetup(socket) {
    if (!socket) {
      socket = this.state.socket
    }
    socket.off('flowBuildStatus')
    const { flowList, changeFlowStatus } = this.props
    const flowId = []
    const flowBuildId = []
    flowList.forEach(item => {
      flowId.push(item.flowId)
      flowBuildId.push(item.lastBuildId)
    })
    this.setState({
      flowId,
      flowBuildId,
      socket
    })
    const self = this
    socket.on('flowBuildStatus', function (data) {
      let index = findIndex(flowId, (item) => {
        return item == data.flowId
      })
      if (flowBuildId[index] != data.flowBuildId) {
        socket.off('flowBuildStatus')
        self.loadData(() => self.onSetUp(socket))
        return
      }
      if (data.status != 200) {
        return
      }
      const result = data.results
      const stateIndex = findIndex(self.props.flowList, flow => {
        return flow.flowId == result.flowId
      })
      let flowListState = cloneDeep(self.state.flowListState)
      flowListState[stateIndex] = {status: result.buildStatus}
      self.setState({
        flowListState
      })
      changeFlowStatus(result.flowId, result.buildStatus)
    })
    socket.emit('flowBuildStatus', { flows: flowId })
  }
  callback(flowId) {
    const count = this.props.config ? this.props.config.length : 0
    const self = this
    const flowList = self.props.flowList
    return (data) => {
      const { getTenxflowBuildLastLogs, getTenxFlowDetail, changeFlowStatus } = this.props;
      getTenxflowBuildLastLogs(flowId, {
        success: {
          func: (result) => {
            const flowListState = cloneDeep(this.state.flowListState)
            const index = findIndex(flowList, flow => {
              return flow.flowId == flowId
            })
            if (index < 0) return
            const status = result.data.results.results.status
            flowListState[index].status = status
            self.setState({
              flowListState
            })
            changeFlowStatus(flowId, status)
          },
          isAsync: true
        },
        failed: {
          func: () => {
            const flowListState = cloneDeep(this.state.flowListState)
            const index = findIndex(flowListState, flow => {
              return flow.flowId == flowId
            })
            if (index < 0) return
            flowListState[index].status == 1
            self.setState({
              flowListState
            })
            changeFlowStatus(flowId, 1)
          }
        }
      })
    }
  }
  onAllChange(e) {
    const flowList = cloneDeep(this.state.flowList)
    if(flowList) {
      flowList.forEach(flow => {
        flow.checked = e.target.checked
      })
      this.setState({
        flowList
      })
    }
    this.setState({
      allChecked: e.target.checked
    })
  }
  deleteCheckFlow() {
    if(this.state.flowList && this.state.flowList.length >0 ){
      const deleteArr = []
      this.state.flowList.forEach(item => {
        if(item.checked) {
          deleteArr.push(item.flowId)
        }
      })
      if(deleteArr.length > 0) {
        const notification = new NotificationHandler()
        notification.spin('删除中')
        this.props.deleteTenxFlow(deleteArr.join(','), {
          success: {
            func: () => {
              notification.close()
              notification.success(`删除成功`);
              this.loadData()
              this.setState({
                allChecked: false,
                showDeleteTenxFlowModal: false
              })
            },
            isAsync: true
          },
          failed: {
            func: (res) => {
              let statusCode = res.statusCode;
              switch (statusCode) {
              case 500:
                break;
              }
              notification.close()
              notification.error(`删除失败`);
            }
          }
        })
      }
    }
  }
  changeCheckStatus(name, e) {
    const { flowList } = cloneDeep(this.state)
    if(flowList) {
      flowList.some(flow => {
        if(flow.name == name) {
          flow.checked = e.target.checked
          return true
        }
      })
      if(flowList.every(flow =>  flow.checked)) {
        this.setState({
          allChecked: true
        })
      } else {
        this.setState({
          allChecked: false
        })
      }

      this.setState({
        flowList
      })
    }
  }
  openDeleteTenxFlowModal() {
    const { flowList } = this.state
    if(flowList && flowList.length > 0) {
      if(flowList.every(item => !item.checked)) return
      const nameArr =  []
      flowList.forEach(item => {
        if(item.checked) {
          nameArr.push(item.name)
        }
      })
      if(nameArr.length == 0) return
      this.setState({
        showDeleteTenxFlowModal: true,
        checkName: nameArr.join(',')
      })
    }
  }
  render() {
    const { formatMessage } = this.props.intl;
    const scope = this;
    const { isFetching, buildFetching, logs, cicdApi, repoBranchesAndTags } = this.props;
    const { searchingFlag } = this.state;
    const flowList = this.props.flowList || []
    let message = '';
    if (flowList.length < 1 && !searchingFlag) {
      message = " * 目前还没有添加任何流水线"
    } else if (flowList.length < 1 && searchingFlag) {
      message = " * 没有匹配到相关流水线"
    }
    return (
      <QueueAnim className='BuildImageList' type='right'>
        <div id='TenxFlowList' key='TenxFlowList'>
          <Title title="构建镜像" />
          <Alert message={<FormattedMessage {...menusText.tooltip} />} type='info' />
          <div className='operaBox'>
            <Button className='createBtn' size='large' type='primary' onClick={this.openCreateTenxFlowModal}>
              <i className='fa fa-plus' />&nbsp;
              <FormattedMessage {...menusText.create} />
            </Button>
            <Button className="refreshBtn"  size='large' type="ghost" onClick={this.loadData.bind(this, null)}>
              <i className='fa fa-refresh' /> 刷 新
            </Button>
            <Input className='searchBox' placeholder={formatMessage(menusText.search)} type='text' onChange={this.onSearchFlow} />
            <i className='fa fa-search'></i>
            <div style={{ clear: 'both' }}></div>
          </div>
          <Card className='tenxflowBox'>
            <div className='titleBox' >
              <div className='name'>
                <FormattedMessage {...menusText.name} />
              </div>
              <div className='time'>
                <FormattedMessage {...menusText.updateTime} />
              </div>
              <div className='code'>
                <FormattedMessage {...menusText.code} />
              </div>
              <div className='image'>
                <FormattedMessage {...menusText.image} />
              </div>
              <div className='status'>
                <FormattedMessage {...menusText.status} />
              </div>
              <div className='opera'>
                <FormattedMessage {...menusText.opera} />
              </div>
            </div>
            {
              (isFetching || !flowList)
                ? <div className='loadingBox'>
                    <Spin size='large' />
                  </div>
                : <MyComponent scope={scope} config={this.state.flowList} isFetching={isFetching} repoBranchesAndTags={repoBranchesAndTags} changeCheckStatus={(name, e) => this.changeCheckStatus(name, e)} checkImage={this.props.checkImage}/>
            }
            {flowList.length < 1 && !searchingFlag ?
              <div className='loadingBox'>暂无数据</div> :
              (flowList.length < 1 && searchingFlag ?
                <div className='loadingBox'>没有找到匹配的流水线</div> : null)}
          </Card>
        </div>
        <Modal
          visible={this.state.createTenxFlowModal}
          title={"构建镜像"}
          className='AppServiceDetail'
          transitionName='move-right'
          onCancel={this.closeCreateTenxFlowModal}
        >
          <CreateTenxFlow scope={scope} isFetching={isFetching} flowList={flowList} buildImage={true}/>
        </Modal>
        <Modal
          visible={this.state.TenxFlowDeployLogModal}
          className='TenxFlowBuildLogModal'
          onCancel={this.closeTenxFlowDeployLogModal}
        >
          <TenxFlowBuildLog scope={scope} isFetching={buildFetching} logs={logs} flowId={this.state.currentFlowId} callback={this.callback(this.state.currentFlowId)} visible={this.state.TenxFlowDeployLogModal}/>
        </Modal>
        <Modal title="删除构建任务" visible={this.state.showDeleteTenxFlowModal}
        onOk={() => this.deleteCheckFlow()} onCancel={() => this.setState({ showDeleteTenxFlowModal: false, checkName: [] })}
        >
          <Alert message="请注意，删除构建任务将清楚所有相关历史数据，且该操作不可恢复" type="warning" showIcon />
          <div className="modalColor" style={{ lineHeight: '30px' }}><i className="anticon anticon-question-circle-o" style={{ marginRight: '8px', marginLeft: '16px' }}></i>
            您确定要删除 {this.state.checkName} 吗？
          </div>
        </Modal>

        {this.state.websocket}
      </QueueAnim>
    )
  }
}

function mapStateToProps(state, props) {
  const defaultFlowList = {
    isFetching: false,
    flowList: [],
  }
  const defaultBuildLog = {
    buildFetching: false,
    logs: [],
  }
  const { getTenxflowList, repoBranchesAndTags } = state.cicd_flow
  const { isFetching, flowList } = getTenxflowList || defaultFlowList
  const { getTenxflowBuildLastLogs } = state.cicd_flow
  const { logs } = getTenxflowBuildLastLogs || defaultBuildLog
  let buildFetching = getTenxflowBuildLastLogs.isFetching || defaultBuildLog.buildFetching
  return {
    isFetching,
    flowList,
    buildFetching,
    logs,
    currentSpace: state.entities.current.space.namespace,
    loginUser: state.entities.loginUser,
    repoBranchesAndTags,
  }
}

TenxFlowList.propTypes = {
  intl: PropTypes.object.isRequired,
}

export default connect(mapStateToProps, {
  getTenxFlowList,
  deleteTenxFlowSingle,
  getTenxflowBuildLastLogs,
  CreateTenxflowBuild,
  getTenxflowBuildDetailLogs,
  changeFlowStatus,
  getRepoBranchesAndTagsByProjectId,
  deleteTenxFlow,
  checkImage
})(injectIntl(TenxFlowList, {
  withRef: true,
}));

