# PGC 生物生成系统：模块联动与数据结构定义

## 1. 模块联动总览
系统采用线性流水线架构，辅以进化反馈环。数据流向如下：
`规则解析` -> `拓扑生成` -> `物理验证` -> `肌肉发生` -> `SDF 融合` -> `Lowpoly 网格化` -> `动画配置`

## 2. 核心数据结构定义

### 2.1 骨骼拓扑数据 (Skeleton Topology JSON)
**由模块一输出，模块二输入**
```json
{
  "version": "2.0",
  "space_constraint": [120, 120, 120],
  "nodes": [
    {
      "id": "spine_01",
      "type": "hub",
      "position": [0, 0, 0],
      "parent": null,
      "semantic_label": "Anatomy.Spine.Root"
    },
    {
      "id": "femur_l",
      "type": "extension",
      "position": [-10, -5, 0],
      "parent": "spine_01",
      "semantic_label": "Anatomy.Limb.Hind.Femur.L"
    }
  ],
  "symmetry_links": [
    {"left": "femur_l", "right": "femur_r"}
  ]
}
```

### 2.2 物理骨架数据 (Physical Skeleton JSON)
**由模块二输出，模块三/四输入**
```json
{
  "skeleton_id": "skel_001",
  "nodes": [
    {
      "id": "femur_l",
      "radius": 4.5,
      "mass": 1.2,
      "center_of_mass": [0, 2.25, 0],
      "inertia_tensor": [...]
    }
  ],
  "global_properties": {
    "total_mass": 15.5,
    "center_of_gravity": [0, 12.5, 2.1],
    "support_polygon": [[-10, -10], [10, -10], [10, 10], [-10, 10]]
  }
}
```

### 2.3 肌肉体积场描述 (Muscle Field Descriptor)
**由模块三输出，模块四输入**
```json
{
  "muscle_groups": [
    {
      "id": "quadriceps_l",
      "origin_node": "pelvis",
      "insertion_node": "tibia_l",
      "pcsa": 12.4,
      "fiber_direction_field": "field_data_ref_01",
      "elasticity": 0.85,
      "jiggle_params": {"stiffness": 100, "damping": 10}
    }
  ]
}
```

### 2.4 动画资产元数据 (Animation Metadata)
**由模块六输出，最终交付**
```json
{
  "asset_id": "creature_lowpoly_001",
  "animations": {
    "idle": {"clip": "idle_01", "loop": true},
    "move": {"clip": "move_forward", "speed_multiplier": 1.2},
    "hit": {"clip": "hit_reaction", "priority": "high"}
  },
  "rigging": {
    "root_bone": "spine_01",
    "ik_chains": [
      {"name": "leg_l", "effector": "foot_l", "pole_vector": [0, 0, 10]}
    ]
  }
}
```

## 3. 模块交互逻辑表
| 发起模块 | 接收模块 | 交互数据 | 触发条件 |
| :--- | :--- | :--- | :--- |
| 模块一 (拓扑) | 模块二 (物理) | 骨骼拓扑 JSON | 拓扑生成完成且通过 GCN 验证 |
| 模块二 (物理) | 模块三 (肌肉) | 物理骨架 JSON | 静态平衡分析通过 |
| 模块三 (肌肉) | 模块四 (SDF) | 肌肉场描述 | 动力学体积优化完成 |
| 模块四 (SDF) | 模块五 (网格) | SDF 场数据 (VDB) | 隐式表面融合完成 |
| 模块五 (网格) | 模块六 (动画) | Lowpoly 网格 (OBJ/FBX) | 网格简化与着色完成 |
| 模块七 (进化) | 模块一 (拓扑) | 变异参数集 | 物理沙盒评估完成，进入下一代 |
